import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import fixture from "./fixtures/postiz-v2.25.3-posts.json";
import { GET } from "../app/api/publisher/[action]/route";
import { env } from "./env";
import { postizPostsSchema } from "../lib/postiz-posts";
import {
  postLabel,
  postDeliveryDetail,
  submissionNotice,
  readPostSettings,
  postContentText,
  postNetwork,
} from "../lib/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PostList } from "../components/dashboard";
vi.mock("../lib/auth", () => ({
  authenticate: vi.fn(async () => ({
    id: "fixture-user",
    email: "fixture@example.com",
  })),
  sameOrigin: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("demuestra que el esquema anterior rechaza exclusivamente settings en la muestra real", () => {
  const previous = z.object({
    posts: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        state: z.string(),
        publishDate: z.string(),
        error: z.string().nullish(),
        releaseURL: z.string().nullish(),
        settings: z
          .object({ content_posting_method: z.string().optional() })
          .nullish(),
        integration: z
          .object({
            name: z.string().optional(),
            providerIdentifier: z.string().optional(),
          })
          .nullish(),
      }),
    ),
  });
  const result = previous.safeParse(fixture);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(
      result.error.issues.map((i) => ({ path: i.path, code: i.code })),
    ).toEqual(
      [0, 1, 2].map((i) => ({
        path: ["posts", i, "settings"],
        code: "invalid_type",
      })),
    );
});

it("conserva null, WEB/API, redes y campos opcionales sin reescribir la muestra", () => {
  const data = postizPostsSchema.parse(fixture);
  expect(data).toEqual(fixture);
  expect(data.posts[0]).toMatchObject({
    releaseURL: null,
    releaseId: null,
    intervalInDays: null,
    creationMethod: "WEB",
    state: "ERROR",
  });
  expect(data.posts[2]).toMatchObject({
    error: null,
    creationMethod: "API",
    state: "PUBLISHED",
  });
  expect(data.posts.map(postNetwork)).toEqual(["TikTok", "TikTok", "YouTube"]);
});
it("acepta listas vacías y publicaciones sin campos opcionales", () => {
  expect(postizPostsSchema.parse({ posts: [] })).toEqual({ posts: [] });
  const minimum = {
    id: "fixture-minimum",
    content: "",
    state: "DRAFT",
    publishDate: "2026-11-13T16:00:00.000Z",
  };
  expect(postizPostsSchema.parse({ posts: [minimum] }).posts[0]).toEqual(
    minimum,
  );
});
it.each(["PUBLISHED", "ERROR", "QUEUE", "DRAFT", "FUTURE_PROVIDER_STATE"])(
  "conserva el estado %s sin inferirlo del campo error",
  (state) => {
    const post = { ...fixture.posts[1], state };
    expect(postizPostsSchema.parse({ posts: [post] }).posts[0]).toEqual(post);
    if (state === "PUBLISHED")
      expect(postLabel(post)).toBe("Publicado según Postiz");
  },
);
it.each(["{invalid", "", "null", "[]", "42", '"text"'])(
  "settings no interpretable no rompe la consulta: %s",
  (settings) => {
    const post = { ...fixture.posts[1], settings };
    expect(postizPostsSchema.parse({ posts: [post] }).posts[0].settings).toBe(
      settings,
    );
    expect(readPostSettings(settings)).toBeNull();
    expect(postLabel(post)).toBe("Publicado según Postiz");
  },
);
it("lee solo los ajustes necesarios sin mutar el JSON original", () => {
  const post = {
    ...fixture.posts[1],
    settings: '{"content_posting_method":"UPLOAD","__type":"tiktok"}',
  };
  expect(postLabel(post)).toBe("Completado según Postiz · UPLOAD");
  expect(typeof post.settings).toBe("string");
  expect(
    readPostSettings({ content_posting_method: "DIRECT_POST" })
      ?.content_posting_method,
  ).toBe("DIRECT_POST");
  expect(readPostSettings(null)).toBeNull();
  expect(readPostSettings(undefined)).toBeNull();
});
it.each([
  ["DRAFT", "No solicitado"],
  ["QUEUE", "todavía no confirmada"],
  ["ERROR", "sin confirmar"],
  ["PUBLISHED", "no acredita publicación"],
  ["UNKNOWN", "no reconocido"],
])("presenta UPLOAD %s sin inventar entrega", (state, expected) => {
  const post = {
    ...fixture.posts[0],
    state,
    settings: { content_posting_method: "UPLOAD" },
  };
  expect(postDeliveryDetail(post)).toContain(expected);
  const html = renderToStaticMarkup(
    createElement(PostList, { posts: [post], loading: false }),
  );
  expect(html).toContain(expected);
  expect(html).not.toContain("Enviado a TikTok");
});
it.each(["now", "schedule"])("aceptación %s no acredita entrega", (action) => {
  expect(submissionNotice(action, ["fixture-post"])).toContain(
    "no confirma entrega",
  );
  expect(submissionNotice(action, ["fixture-post"])).toContain("fixture-post");
});
it("un borrador no se presenta como solicitado a TikTok", () => {
  expect(submissionNotice("draft", ["fixture-post"])).toContain(
    "No se ha solicitado",
  );
});
it("renderiza la lista compartida por ambas vistas con redes, fechas y estados principales", () => {
  const html = renderToStaticMarkup(
    createElement(PostList, { posts: fixture.posts, loading: false }),
  );
  expect(html.match(/class="post-row"/g) || []).toHaveLength(3);
  expect(html).toContain("TikTok");
  expect(html).toContain("YouTube");
  expect(html).toContain("2026");
  expect(html).toContain("accion a invertir paso a paso");
  expect(html).not.toContain("&lt;p&gt;");
  expect(html.match(/status-published/g) || []).toHaveLength(2);
  expect(html.match(/status-error/g) || []).toHaveLength(1);
  expect(html).toContain("Error de publicación:");
  expect(html).toContain(
    "Mensaje histórico informado por Postiz (no cambia el estado):",
  );
  expect(
    html.match(/App not approved for public posting, contact support/g) || [],
  ).toHaveLength(2);
});
it("no ejecuta HTML, atributos ni enlaces javascript; las entidades se renderizan como texto", () => {
  const malicious = {
    ...fixture.posts[0],
    content:
      '<p>Hola &amp; mundo</p><img src=x onerror="alert(1)"><script>alert(2)</script>&lt;img src=x onerror=alert(3)&gt;',
    releaseURL: "javascript:alert(4)",
  };
  const html = renderToStaticMarkup(
    createElement(PostList, { posts: [malicious], loading: false }),
  );
  expect(html).toContain("Hola &amp; mundo");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("&lt;img"); // decoded entity remains an escaped React text node.
  expect(postContentText("Texto plano\n\n#n8n")).toBe("Texto plano\n\n#n8n");
});
it("sirve la respuesta real de Postiz sin POSTIZ_SCHEMA ni alteración de sus campos", async () => {
  env.POSTIZ_API_KEY = "fixture-key";
  const logs = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(fixture)),
  );
  const response = await GET(
    new Request(
      "https://social.mavetio.com/api/publisher/posts?startDate=2026-11-01T00:00:00.000Z&endDate=2026-11-14T00:00:00.000Z",
    ),
    { params: Promise.resolve({ action: "posts" }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(fixture);
  expect(logs).not.toHaveBeenCalled();
});
