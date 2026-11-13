import { describe, expect, it, vi } from "vitest";
import {
  queryCreator,
  validateDirect,
  parseCreator,
  creatorForOrganization,
} from "../extensions/postiz/mavetio-tiktok";
import {
  emptyDirect,
  DirectPostFields,
} from "../components/direct-post-fields";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mp4Duration } from "../lib/mp4-duration";
const data = {
  creator_nickname: "Fixture",
  creator_username: "fixture",
  privacy_level_options: ["FOLLOWER_OF_CREATOR", "SELF_ONLY"],
  comment_disabled: true,
  duet_disabled: true,
  stitch_disabled: true,
  max_video_post_duration_sec: 60,
};
const creator = () =>
  parseCreator({
    ...data,
    checkedAt: new Date().toISOString(),
    contract: "mavetio-tiktok-v1",
  });
describe("Extensión privada creator_info", () => {
  it.each([
    { organizationId: "other" },
    { disabled: true },
    { refreshNeeded: true },
    { deletedAt: new Date() },
    { providerIdentifier: "youtube" },
    { token: "" },
  ])("no consulta tokens de canales no autorizados %j", async (change) => {
    const find = vi
      .fn()
      .mockResolvedValue({
        organizationId: "org",
        token: "fixture",
        providerIdentifier: "tiktok",
        disabled: false,
        ...change,
      });
    const network = vi.fn<typeof fetch>();
    await expect(
      creatorForOrganization("org", "channel", find, network),
    ).rejects.toThrow("CHANNEL_UNAVAILABLE");
    expect(find).toHaveBeenCalledWith("org", "channel");
    expect(network).not.toHaveBeenCalled();
  });
  it("consulta solo TikTok y elimina datos no autorizados de la respuesta", async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: { ...data, token: "never-return" },
        error: { code: "ok" },
      }),
    );
    const result = await queryCreator("fixture-token", mock);
    expect(mock.mock.calls[0][0]).toBe(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    );
    expect(mock.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.stringify(result)).not.toContain("token");
    expect(result.privacy_level_options).toEqual(["SELF_ONLY"]);
  });
  it.each([
    "scope_not_authorized",
    "spam_risk_user_banned_from_posting",
    "reached_active_user_cap",
    "spam_risk_too_many_posts",
  ])("rechaza error HTTP200 %s sin filtrar texto", async (code) => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data, error: { code, message: "secret detail" } }),
      );
    await expect(queryCreator("fixture", mock)).rejects.toThrow(
      "CREATOR_NOT_AUTHORIZED",
    );
  });
  it("rechaza JSON y errores de red sin exponer excepción", async () => {
    await expect(
      queryCreator(
        "fixture",
        vi.fn<typeof fetch>().mockResolvedValue(new Response("invalid")),
      ),
    ).rejects.toThrow("CREATOR_INVALID");
    await expect(
      queryCreator(
        "fixture",
        vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive")),
      ),
    ).rejects.toThrow("CREATOR_UNREACHABLE");
  });
  it.each([{ options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"] }, { options: ["SELF_ONLY"] }])(
    "no habilita cuentas públicas o indeterminadas: %j",
    async ({ options }) => {
      await expect(
        queryCreator(
          "fixture",
          vi
            .fn<typeof fetch>()
            .mockResolvedValue(
              Response.json({
                data: { ...data, privacy_level_options: options },
                error: { code: "ok" },
              }),
            ),
        ),
      ).rejects.toThrow("PRIVATE_ACCOUNT_REQUIRED");
    },
  );
  it("valida duración, interacciones y comerciales", () => {
    expect(() => validateDirect(emptyDirect, creator(), 10)).not.toThrow();
    expect(() => validateDirect(emptyDirect, creator(), 61)).toThrow(
      "VIDEO_TOO_LONG",
    );
    expect(() =>
      validateDirect({ ...emptyDirect, comment: true }, creator(), 10),
    ).toThrow("INTERACTION_NOT_ALLOWED");
    expect(() =>
      validateDirect(
        { ...emptyDirect, brand_content_toggle: true },
        creator(),
        10,
      ),
    ).toThrow("BRANDED_CONTENT");
  });
  it("no preselecciona privacidad ni activa interacciones o música", () => {
    const html = renderToStaticMarkup(
      createElement(DirectPostFields, {
        creator: creator(),
        privacy: "",
        onPrivacy: () => {},
        value: emptyDirect,
        onChange: () => {},
        music: false,
        onMusic: () => {},
      }),
    );
    expect(html).toContain('value="" selected=""');
    expect(html).not.toContain('checked=""');
    expect(html).not.toContain("PUBLIC_TO_EVERYONE");
    expect(html).toContain("music-usage-confirmation");
  });
});
describe("Duración del MP4 firmado", () => {
  it("lee mvhd y rechaza cajas truncadas o escala cero", () => {
    const bytes = new Uint8Array(36);
    const v = new DataView(bytes.buffer);
    v.setUint32(0, 36);
    bytes.set(new TextEncoder().encode("moov"), 4);
    v.setUint32(8, 28);
    bytes.set(new TextEncoder().encode("mvhd"), 12);
    v.setUint32(28, 1000);
    v.setUint32(32, 10000);
    expect(mp4Duration(bytes)).toBe(10);
    expect(mp4Duration(bytes.subarray(0, 35))).toBeUndefined();
    v.setUint32(28, 0);
    expect(mp4Duration(bytes)).toBeUndefined();
  });
});
