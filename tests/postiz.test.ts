import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "./env";
import { config } from "../lib/env";
import {
  postiz,
  integrations,
  POSTIZ_BASE_URL,
  POSTIZ_TIMEOUT_MS,
} from "../lib/postiz";
import { GET } from "../app/api/publisher/[action]/route";

vi.mock("../lib/auth", () => ({
  authenticate: vi.fn(async () => ({
    id: "test-user",
    email: "fixture@example.com",
  })),
  sameOrigin: vi.fn(),
}));
let logs: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    POSTIZ_API_KEY: "private-test-key",
    MEDIA_SIGNING_SECRET: "private-signing-secret",
    POSTIZ_API_URL: POSTIZ_BASE_URL,
  });
  logs = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function response(status: number, body = "{}") {
  const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const query =
  "?startDate=2026-11-01T00%3A00%3A00.000Z&endDate=2026-11-13T23%3A59%3A59.999Z";
function get(action: string) {
  return GET(
    new Request(
      `https://social.mavetio.com/api/publisher/${action}${action === "posts" ? query : ""}`,
    ),
    { params: Promise.resolve({ action }) },
  );
}
describe("Postiz transport and GET endpoint regressions", () => {
  it("reads the Workers binding on every call and preserves the exact API prefix", async () => {
    expect(config()).toBe(env);
    const fetcher = response(200, "[]");
    await integrations();
    env.POSTIZ_API_KEY = "rotated-test-key";
    await postiz(`/posts${query}`);
    expect(fetcher.mock.calls[0][0]).toBe(`${POSTIZ_BASE_URL}/integrations`);
    expect(fetcher.mock.calls[1][0]).toBe(`${POSTIZ_BASE_URL}/posts${query}`);
    const init = fetcher.mock.calls[1][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "rotated-test-key",
    );
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
    expect(logs).not.toHaveBeenCalled();
  });
  it("uses the correct fallback and removes a trailing slash", async () => {
    delete env.POSTIZ_API_URL;
    const fetcher = response(200, "[]");
    await integrations();
    env.POSTIZ_API_URL = POSTIZ_BASE_URL + "/";
    await integrations();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      `${POSTIZ_BASE_URL}/integrations`,
      `${POSTIZ_BASE_URL}/integrations`,
    ]);
  });
  it.each([
    "http://postiz.mavetio.com/api/public/v1",
    "not a url",
    "https://user:pass@postiz.mavetio.com/api/public/v1",
    "https://postiz.mavetio.com/api/public/v1?token=x",
  ])("rejects unsafe configuration: %s", async (base) => {
    env.POSTIZ_API_URL = base;
    const fetcher = response(200);
    await expect(postiz("/integrations")).rejects.toMatchObject({
      status: 503,
      code: "POSTIZ_CONFIG",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ["ENOTFOUND", "DNS lookup failed"],
    ["CERT_HAS_EXPIRED", "certificate expired"],
    ["ECONNRESET", "socket reset"],
  ])("records transport diagnostics for %s", async (code, message) => {
    const cause = Object.assign(new Error(message), { code });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed", { cause });
      }),
    );
    await expect(postiz("/integrations")).rejects.toMatchObject({
      status: 502,
      code: "POSTIZ_CONNECTION_ERROR",
    });
    expect(logs).toHaveBeenCalledWith(
      "[postiz.request.failed]",
      expect.objectContaining({
        endpoint: `${POSTIZ_BASE_URL}/integrations`,
        httpStatus: null,
        exceptionName: "TypeError",
        exceptionMessage: "fetch failed",
        causeCode: code,
        causeMessage: message,
      }),
    );
  });
  it.each([301, 302, 307, 308])(
    "does not follow or log a redirect HTTP %s",
    async (status) => {
      const fetcher = vi.fn(
        async () =>
          new Response(null, {
            status,
            headers: {
              Location:
                "https://other.example/login?token=private-redirect-token",
            },
          }),
      );
      vi.stubGlobal("fetch", fetcher);
      await expect(postiz("/integrations")).rejects.toMatchObject({
        status: 502,
        code: "POSTIZ_REDIRECT",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(logs.mock.calls)).not.toContain(
        "private-redirect-token",
      );
      expect(JSON.stringify(logs.mock.calls)).not.toContain("other.example");
    },
  );
  it.each(["integrations", "posts"])(
    "%s preserves each upstream HTTP category through the route",
    async (action) => {
      for (const [status, code] of [
        [401, "POSTIZ_AUTH_ERROR"],
        [403, "POSTIZ_AUTH_ERROR"],
        [404, "POSTIZ_NOT_FOUND"],
        [429, "POSTIZ_429"],
        [500, "POSTIZ_UPSTREAM_ERROR"],
        [502, "POSTIZ_UPSTREAM_ERROR"],
        [503, "POSTIZ_UPSTREAM_ERROR"],
        [504, "POSTIZ_UPSTREAM_ERROR"],
      ] as const) {
        response(status, "<html>not JSON; secret response</html>");
        const result = await get(action);
        expect(result.status).toBe(status);
        expect(await result.json()).toMatchObject({ code });
        expect(logs).toHaveBeenLastCalledWith(
          "[postiz.request.failed]",
          expect.objectContaining({ httpStatus: status, code }),
        );
      }
      expect(JSON.stringify(logs.mock.calls)).not.toContain("secret response");
    },
  );
  it("times out before receiving headers with 504 and the configured budget", async () => {
    const controller = new AbortController();
    const timer = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort(new DOMException("timeout", "TimeoutError"));
        throw controller.signal.reason;
      }),
    );
    const result = await get("integrations");
    expect(result.status).toBe(504);
    expect(await result.json()).toMatchObject({ code: "POSTIZ_TIMEOUT" });
    expect(timer).toHaveBeenCalledWith(POSTIZ_TIMEOUT_MS);
  });
  it("times out while reading the response body", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        text: async () => {
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        },
      })),
    );
    await expect(postiz("/posts")).rejects.toMatchObject({
      status: 504,
      code: "POSTIZ_TIMEOUT",
    });
    expect(logs).toHaveBeenCalledWith(
      "[postiz.request.failed]",
      expect.objectContaining({ httpStatus: 200 }),
    );
  });
  it("distinguishes body interruption from invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        text: async () => {
          throw new TypeError("connection lost");
        },
      })),
    );
    await expect(postiz("/posts")).rejects.toMatchObject({
      status: 502,
      code: "POSTIZ_BODY_ERROR",
    });
  });
  it("respects caller cancellation instead of dropping its signal", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        throw init.signal.reason;
      }),
    );
    await expect(
      postiz("/posts", { signal: controller.signal }),
    ).rejects.toMatchObject({ status: 408, code: "POSTIZ_ABORTED" });
  });
  it.each([
    "",
    "<html>session-token-here</html>",
    '{"token":"private-json-token"',
  ])(
    "classifies invalid JSON without logging its content (%s)",
    async (body) => {
      response(200, body);
      const result = await get("posts");
      expect(result.status).toBe(502);
      expect(await result.json()).toMatchObject({
        code: "POSTIZ_INVALID_JSON",
      });
      const logged = JSON.stringify(logs.mock.calls);
      expect(logged).not.toContain("private-json-token");
      expect(logged).not.toContain("session-token-here");
    },
  );
  it.each(["posts", "integrations"])(
    "reports upstream schema errors as upstream failures, not input errors: %s",
    async (action) => {
      response(200, "null");
      const result = await get(action);
      expect(result.status).toBe(502);
      expect(await result.json()).toMatchObject({ code: "POSTIZ_SCHEMA" });
    },
  );
  it("successful empty API responses are passed through, not fabricated", async () => {
    response(200, "[]");
    expect(await (await get("integrations")).json()).toEqual([]);
    response(200, '{"posts":[]}');
    expect(await (await get("posts")).json()).toEqual({ posts: [] });
  });
  it("sanitizes credentials, cookies, exception causes and URL queries", async () => {
    const cause = new Error(
      "Cookie: secret-cookie; other=hidden\nAuthorization: Bearer hidden-token",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(
          "private-test-key private-signing-secret https://example.com/?token=query-secret\nSet-Cookie: token-cookie\naccess_token=access-secret",
          { cause },
        );
      }),
    );
    await expect(postiz(`/posts?token=query-secret`)).rejects.toMatchObject({
      code: "POSTIZ_CONNECTION_ERROR",
    });
    const logged = JSON.stringify(logs.mock.calls);
    for (const secret of [
      "private-test-key",
      "private-signing-secret",
      "secret-cookie",
      "hidden-token",
      "query-secret",
      "token-cookie",
      "access-secret",
      "other=hidden",
    ])
      expect(logged).not.toContain(secret);
    expect(logs).toHaveBeenCalledWith(
      "[postiz.request.failed]",
      expect.objectContaining({ endpoint: `${POSTIZ_BASE_URL}/posts` }),
    );
  });
});
