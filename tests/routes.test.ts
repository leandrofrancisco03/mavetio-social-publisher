import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import { env } from "./env";
import { GET, POST } from "../app/api/publisher/[action]/route";

vi.mock("../lib/auth", () => ({
  authenticate: vi.fn(async () => ({
    id: "user-1",
    email: "tester@example.com",
  })),
  sameOrigin: vi.fn(),
}));
const secret = "test-only-signing-secret-with-more-than-32-characters";
let postCalls = 0;
let upstreamFailure = false;
let db: DatabaseSync;
beforeEach(() => {
  db?.close();
  db = new DatabaseSync(":memory:");
  db.exec(readFileSync("migrations/0001_submissions.sql", "utf8"));
  Object.assign(env, {
    TIKTOK_DIRECT_POST_ENABLED: "false",
    POSTIZ_API_KEY: "test-only-key",
    MEDIA_SIGNING_SECRET: secret,
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: (string | number)[]) => ({
          run: async () => ({
            meta: { changes: db.prepare(sql).run(...values).changes },
          }),
          first: async () => db.prepare(sql).get(...values) || null,
        }),
      }),
    },
  });
  postCalls = 0;
  upstreamFailure = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/integrations"))
        return Response.json([
          {
            id: "channel",
            name: "Test fixture",
            identifier: "tiktok",
            disabled: false,
          },
        ]);
      if (url.endsWith("/posts")) {
        postCalls++;
        if (upstreamFailure) throw new Error("network timeout");
        return Response.json([
          { postId: "post-fixture", integration: "channel" },
        ]);
      }
      throw new Error("Unexpected URL in unit test");
    }),
  );
});
async function submission(subject = "user-1", directVideo = false) {
  const mediaReceipt = await new SignJWT({
    id: "uploaded-file",
    path: "https://uploads.postiz.com/video.mp4",
    ...(directVideo ? { directVideo: true, duration: 10 } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setAudience("mavetio-media")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));
  return {
    requestId: crypto.randomUUID(),
    integrationId: "channel",
    title: "Prueba unitaria",
    description: "Solo fixture de prueba",
    action: "now",
    method: "UPLOAD",
    consent: true,
    mediaReceipt,
  };
}
async function send(input: unknown) {
  return POST(
    new Request("https://social.mavetio.com/api/publisher/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://social.mavetio.com",
      },
      body: JSON.stringify(input),
    }),
    { params: Promise.resolve({ action: "submit" }) },
  );
}
describe("Límites y registro persistente de envíos", () => {
  const creator = () => ({
    contract: "mavetio-tiktok-v1",
    checkedAt: new Date().toISOString(),
    creator_nickname: "Fixture",
    creator_username: "fixture",
    privacy_level_options: ["SELF_ONLY"],
    comment_disabled: true,
    duet_disabled: true,
    stitch_disabled: true,
    max_video_post_duration_sec: 60,
  });
  async function directInput() {
    return {
      ...(await submission("user-1", true)),
      method: "DIRECT_POST",
      action: "now",
      musicConsent: true,
      finalConfirmation: true,
      direct: {
        privacy_level: "SELF_ONLY",
        comment: false,
        duet: false,
        stitch: false,
        brand_organic_toggle: false,
        brand_content_toggle: false,
        video_made_with_ai: false,
      },
    };
  }
  function enableDirect(value: unknown = creator(), status = 200) {
    env.TIKTOK_DIRECT_POST_ENABLED = "true";
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (...args) =>
      String(args[0]).includes("/creator-info")
        ? Response.json(value, { status })
        : original(...args),
    );
  }
  it("Direct Post autorizado conserva payload y deduplicación", async () => {
    enableDirect();
    const input = await directInput();
    expect((await send(input)).status).toBe(201);
    expect((await send(input)).status).toBe(200);
    expect(postCalls).toBe(1);
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith("/posts"));
    const payload = JSON.parse(String(call?.[1]?.body));
    expect(payload.posts[0].settings.content_posting_method).toBe(
      "DIRECT_POST",
    );
    expect(payload.posts[0].settings.privacy_level).toBe("SELF_ONLY");
    expect(payload.posts[0].integration.id).toBe("channel");
    expect(payload.posts[0].value[0].image[0]).not.toHaveProperty("duration");
  });
  it.each([404, 401, 409, 500])(
    "bloquea extensión ausente o sin permiso %s",
    async (status) => {
      enableDirect({ error: "fixture" }, status);
      expect((await send(await directInput())).status).toBe(409);
      expect(postCalls).toBe(0);
    },
  );
  it.each([
    { privacy_level_options: ["PUBLIC_TO_EVERYONE"] },
    { max_video_post_duration_sec: 5 },
    { checkedAt: "2020-01-01T00:00:00Z" },
  ])("bloquea restricciones nuevas o caducadas %j", async (change) => {
    enableDirect({ ...creator(), ...change });
    expect((await send(await directInput())).status).toBe(409);
    expect(postCalls).toBe(0);
  });
  it("bloquea interacción prohibida sin escritura externa", async () => {
    enableDirect();
    const input = await directInput();
    input.direct.comment = true;
    expect((await send(input)).status).toBe(409);
    expect(postCalls).toBe(0);
  });
  it.each(["schedule", "draft"])(
    "Direct Post no permite %s sin validación de ejecución completa",
    async (action) => {
      enableDirect();
      expect((await send({ ...(await directInput()), action })).status).toBe(
        400,
      );
      expect(postCalls).toBe(0);
    },
  );
  it.each(["musicConsent", "finalConfirmation"])("exige %s", async (field) => {
    enableDirect();
    expect(
      (await send({ ...(await directInput()), [field]: false })).status,
    ).toBe(400);
    expect(postCalls).toBe(0);
  });
  it("no acepta duración declarada por navegador ni recibo UPLOAD antiguo para Direct Post", async () => {
    enableDirect();
    const input = await directInput();
    input.mediaReceipt = (await submission()).mediaReceipt;
    expect((await send(input)).status).toBe(400);
    expect(postCalls).toBe(0);
  });
  it("Direct Post timeout no se repite", async () => {
    enableDirect();
    upstreamFailure = true;
    const input = await directInput();
    expect((await send(input)).status).toBe(502);
    expect((await send(input)).status).toBe(409);
    expect(postCalls).toBe(1);
  });
  async function connect(body: unknown) {
    return POST(
      new Request("https://social.mavetio.com/api/publisher/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ action: "connect" }) },
    );
  }
  it.each(["channel", "", "unknown"])(
    "bloquea reconexión directa %s sin llamar a Postiz",
    async (refresh) => {
      const response = await connect({ refresh });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("RECONNECT_IN_POSTIZ");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("conecta sin refresh ni retorno inventado y conserva el estado de Postiz", async () => {
    const url =
      "https://www.tiktok.com/v2/auth/authorize/?client_key=fixture&state=unit-test-state";
    vi.mocked(fetch).mockResolvedValue(Response.json({ url }));
    const response = await connect({});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(
      /\/api\/public\/v1\/social\/tiktok$/,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    "https://attacker.test/?client_key=fixture",
    "http://www.tiktok.com/?client_key=fixture",
    "https://www.tiktok.com/",
  ])("rechaza autorización inválida %s", async (url) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ url }));
    const response = await connect({});
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("OAUTH_NOT_READY");
  });
  it("reutiliza la respuesta para el mismo envío sin publicar dos veces", async () => {
    const input = await submission();
    expect((await send(input)).status).toBe(201);
    const again = await send(input);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual([
      { postId: "post-fixture", integration: "channel" },
    ]);
    expect(postCalls).toBe(1);
  });
  it("bloquea dos solicitudes concurrentes con la misma clave", async () => {
    const input = await submission();
    const responses = await Promise.all([send(input), send(input)]);
    expect(responses.some((r) => r.status === 201)).toBe(true);
    expect(postCalls).toBe(1);
  });
  it("no reenvía después de un timeout de resultado desconocido", async () => {
    upstreamFailure = true;
    const input = await submission();
    expect((await send(input)).status).toBe(502);
    expect((await send(input)).status).toBe(409);
    expect(postCalls).toBe(1);
    expect(
      db
        .prepare("SELECT status FROM submissions WHERE id=?")
        .get(input.requestId)?.status,
    ).toBe("unknown");
  });
  it("envía POST /posts con UPLOAD, cuenta seleccionada y archivo firmado", async () => {
    const input = await submission();
    const response = await send(input);
    expect(response.status).toBe(201);
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith("/posts"));
    expect(call?.[1]?.method).toBe("POST");
    const payload = JSON.parse(String(call?.[1]?.body));
    expect(payload.type).toBe("now");
    expect(payload.posts[0].integration).toEqual({ id: input.integrationId });
    expect(payload.posts[0].settings.content_posting_method).toBe("UPLOAD");
    expect(payload.posts[0].value[0].image[0].id).toBe("uploaded-file");
    expect(
      db
        .prepare("SELECT status FROM submissions WHERE id=?")
        .get(input.requestId)?.status,
    ).toBe("completed");
  });
  it("un timeout real mantiene resultado desconocido y no reintenta", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith("/integrations"))
        return Response.json([
          {
            id: "channel",
            name: "Fixture",
            identifier: "tiktok",
            disabled: false,
          },
        ]);
      postCalls++;
      throw new DOMException("test timeout", "TimeoutError");
    });
    const input = await submission();
    expect((await send(input)).status).toBe(504);
    expect((await send(input)).status).toBe(409);
    expect(postCalls).toBe(1);
  });
  it("rechaza reutilizar la clave para un contenido distinto", async () => {
    const input = await submission();
    await send(input);
    expect((await send({ ...input, title: "Distinto" })).status).toBe(409);
    expect(postCalls).toBe(1);
  });
  it("rechaza archivos firmados para otro usuario", async () => {
    expect((await send(await submission("other-user"))).status).toBe(400);
    expect(postCalls).toBe(0);
  });
  it("rechaza cuentas ajenas antes de publicar", async () => {
    expect(
      (await send({ ...(await submission()), integrationId: "foreign" }))
        .status,
    ).toBe(400);
    expect(postCalls).toBe(0);
  });
  it("rechaza fechas pasadas y Direct Post", async () => {
    expect(
      (
        await send({
          ...(await submission()),
          action: "schedule",
          date: "2020-01-01T00:00:00.000Z",
        })
      ).status,
    ).toBe(400);
    expect(
      (await send({ ...(await submission()), method: "DIRECT_POST" })).status,
    ).toBe(409);
    expect(postCalls).toBe(0);
  });
  it.each([
    "SELF_ONLY",
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "FOLLOWER_OF_CREATOR",
  ])(
    "bloquea Direct Post con privacidad %s antes de cualquier efecto",
    async (privacy) => {
      const input = {
        ...(await submission()),
        method: "DIRECT_POST",
        privacy_level: privacy,
        permissions: ["video.publish"],
        creatorInfo: { privacy_level_options: [privacy] },
      };
      const response = await send(input);
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("DIRECT_POST_UNAVAILABLE");
      expect(fetch).not.toHaveBeenCalled();
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM submissions").get()?.count,
      ).toBe(0);
    },
  );
  it("no acepta ajustes Direct Post ocultos dentro de UPLOAD", async () => {
    const response = await send({
      ...(await submission()),
      settings: {
        content_posting_method: "DIRECT_POST",
        privacy_level: "PUBLIC_TO_EVERYONE",
      },
    });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([false, undefined])(
    "rechaza UPLOAD sin consentimiento explícito: %s",
    async (consent) => {
      expect((await send({ ...(await submission()), consent })).status).toBe(
        400,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("rechaza carga demasiado grande sin leerla ni llamar a Postiz", async () => {
    const result = await POST(
      new Request("https://social.mavetio.com/api/publisher/upload", {
        method: "POST",
        headers: { "content-length": "30000000" },
        body: "x",
      }),
      { params: Promise.resolve({ action: "upload" }) },
    );
    expect(result.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rechaza archivos que solo aparentan ser vídeos", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["not really a video"], "video.mp4", { type: "video/mp4" }),
    );
    const result = await POST(
      new Request("https://social.mavetio.com/api/publisher/upload", {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ action: "upload" }) },
    );
    expect(result.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("limita el rango de consulta", async () => {
    const result = await GET(
      new Request(
        "https://social.mavetio.com/api/publisher/posts?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T00:00:00.000Z",
      ),
      { params: Promise.resolve({ action: "posts" }) },
    );
    expect(result.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
