import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PostizReconnectLink,
  TikTokAuthorizationLink,
  postizManagementUrl,
} from "../components/postiz-navigation";

describe("Navegación de OAuth delegado", () => {
  it("abre la gestión real sin propagar parámetros ni identificadores", () => {
    expect(
      postizManagementUrl("https://postiz.mavetio.com/old?code=fixture#state"),
    ).toBe("https://postiz.mavetio.com/launches");
    const html = renderToStaticMarkup(
      createElement(PostizReconnectLink, {
        baseUrl: "https://postiz.mavetio.com",
        name: "Cuenta de prueba",
      }),
    );
    expect(html).toContain('href="https://postiz.mavetio.com/launches"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("refresh=");
  });
  it.each([
    undefined,
    "javascript:alert(1)",
    "http://postiz.test",
    "https://user:password@postiz.test",
  ])("rechaza gestión insegura: %s", (value) => {
    expect(postizManagementUrl(value)).toBeUndefined();
    expect(
      renderToStaticMarkup(
        createElement(PostizReconnectLink, { baseUrl: value, name: "Prueba" }),
      ),
    ).not.toContain("href=");
  });
  it("conserva Mavetio abierto mientras se autoriza en otra pestaña", () => {
    const html = renderToStaticMarkup(
      createElement(TikTokAuthorizationLink, {
        url: "https://www.tiktok.com/v2/auth/authorize/?client_key=fixture",
      }),
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("https://www.tiktok.com/v2/auth/authorize/");
  });
});
