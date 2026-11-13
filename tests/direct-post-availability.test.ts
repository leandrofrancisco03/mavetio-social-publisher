import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DirectPostAvailability } from "../components/direct-post-availability";
import { postDeliveryDetail, postLabel } from "../lib/types";

it("explica el bloqueo sin simular privacidad ni permiso concedido", () => {
  const html = renderToStaticMarkup(createElement(DirectPostAvailability));
  expect(html).toContain("Direct Post bloqueado");
  expect(html).toContain("video.publish");
  expect(html).toContain("SELF_ONLY si TikTok lo devuelve");
  expect(html).not.toContain("<select");
  expect(html).not.toContain("<input");
});

it.each([
  ["PUBLISHED", "Publicado según Postiz"],
  ["QUEUE", "Aún no consta publicación completada"],
  ["DRAFT", "no acredita publicación"],
  ["ERROR", "sin confirmar"],
  ["UNRECOGNIZED", "desconocido"],
])(
  "explica el estado Direct Post %s sin confundirlo con bandeja",
  (state, detail) => {
    const post = {
      id: "fixture",
      content: "fixture",
      publishDate: "2026-11-13T12:00:00Z",
      state,
      settings: JSON.stringify({ content_posting_method: "DIRECT_POST" }),
    };
    expect(postDeliveryDetail(post)).toContain(detail);
    expect(postDeliveryDetail(post)).not.toContain("bandeja");
    expect(postLabel(post)).not.toContain("UPLOAD");
  },
);
