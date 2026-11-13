import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { env } from "./env";
import { authenticate, sameOrigin } from "../lib/auth";
import { postiz } from "../lib/postiz";
import { safeMessage } from "../lib/errors";
import { buildPost, submissionSchema } from "../lib/submissions";
import { postLabel } from "../lib/types";

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  vi.unstubAllGlobals();
});
describe("Autenticación y protección del servidor", () => {
  it("deniega acceso si Access no está configurado", async () => {
    await expect(authenticate(new Headers())).rejects.toMatchObject({
      status: 503,
    });
  });
  it("no confía en un correo enviado como cabecera", async () => {
    Object.assign(env, {
      CF_ACCESS_TEAM_DOMAIN: "mavetio.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud",
    });
    await expect(
      authenticate(
        new Headers({
          "cf-access-authenticated-user-email": "admin@example.com",
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rechaza JWT con firma falsificada", async () => {
    Object.assign(env, {
      CF_ACCESS_TEAM_DOMAIN: "signature-test.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud",
    });
    const { publicKey } = await generateKeyPair("RS256");
    const { privateKey: attackerKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    Object.assign(jwk, { kid: "test", alg: "RS256", use: "sig" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    const token = await new SignJWT({ email: "admin@example.com" })
      .setSubject("user")
      .setIssuer("https://signature-test.cloudflareaccess.com")
      .setAudience("aud")
      .setIssuedAt()
      .setExpirationTime("1h")
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .sign(attackerKey);
    await expect(
      authenticate(new Headers({ "cf-access-jwt-assertion": token })),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("bloquea CSRF incluso con sesión válida", () => {
    env.APP_URL = "https://social.mavetio.com";
    expect(() =>
      sameOrigin(
        new Request("https://social.mavetio.com/api/publisher/submit", {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      sameOrigin(
        new Request("https://social.mavetio.com/api/publisher/submit", {
          method: "POST",
          headers: { origin: "https://social.mavetio.com" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      sameOrigin(
        new Request("https://social.mavetio.com/api/publisher/submit", {
          method: "POST",
        }),
      ),
    ).toThrow();
  });
  it("no llama a Postiz sin credenciales", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(postiz("/integrations")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("envía la clave solo al backend de Postiz, sin Bearer ni redirecciones", async () => {
    env.POSTIZ_API_KEY = "server-only-secret";
    const fetcher = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetcher);
    await postiz("/integrations");
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://postiz.mavetio.com/api/public/v1/integrations");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "server-only-secret",
    );
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
  });
  it("muestra errores reales sin reflejar credenciales", async () => {
    env.POSTIZ_API_KEY = "secret-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "Rejected secret-key access_token=private-token" },
          { status: 429 },
        ),
      ),
    );
    await expect(postiz("/posts")).rejects.toMatchObject({
      code: "POSTIZ_429",
      status: 429,
    });
    expect(
      safeMessage("secret-key access_token=private-token", ["secret-key"]),
    ).not.toContain("private-token");
  });
});
describe("Contrato de publicación", () => {
  const input = {
    requestId: "b0529105-194e-49d6-af34-f00c9836525a",
    integrationId: "channel",
    title: "Mi vídeo",
    description: "Descripción",
    action: "schedule",
    date: "2026-12-01T17:00:00.000Z",
    method: "UPLOAD",
    mediaReceipt: "a".repeat(30),
    consent: true,
  };
  it("exige consentimiento explícito y rechaza Direct Post", () => {
    expect(
      submissionSchema.safeParse({ ...input, consent: false }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({ ...input, method: "DIRECT_POST" }).success,
    ).toBe(false);
  });
  it("impide inyectar una URL multimedia ajena", () => {
    expect(
      submissionSchema.safeParse({
        ...input,
        path: "https://attacker.example/video.mp4",
      }).success,
    ).toBe(false);
  });
  it("conserva fecha UTC, texto y referencia de Postiz", () => {
    const data = buildPost(submissionSchema.parse(input), {
      id: "media",
      path: "https://uploads.postiz.com/video.mp4",
    });
    expect(data.date).toBe(input.date);
    expect(data.posts[0].value[0].content).toBe("Mi vídeo\n\nDescripción");
    expect(data.posts[0].settings.content_posting_method).toBe("UPLOAD");
    expect(data.posts[0].value[0].image[0].id).toBe("media");
  });
  it("no presenta una entrega a bandeja como publicación en perfil", () => {
    expect(
      postLabel({
        id: "id",
        content: "",
        publishDate: "",
        state: "PUBLISHED",
        settings: { content_posting_method: "UPLOAD" },
      }),
    ).toBe("Enviado a TikTok · completar en la app");
  });
});
