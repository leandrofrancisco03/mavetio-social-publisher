import type {
  Creator,
  DirectSettings,
} from "@/extensions/postiz/mavetio-tiktok";
export const emptyDirect: DirectSettings = {
  privacy_level: "SELF_ONLY",
  comment: false,
  duet: false,
  stitch: false,
  brand_content_toggle: false,
  brand_organic_toggle: false,
  video_made_with_ai: false,
};
export function DirectPostFields({
  creator,
  privacy,
  onPrivacy,
  value,
  onChange,
  music,
  onMusic,
}: {
  creator: Creator;
  privacy: string;
  onPrivacy: (v: string) => void;
  value: DirectSettings;
  onChange: (v: DirectSettings) => void;
  music: boolean;
  onMusic: (v: boolean) => void;
}) {
  return (
    <div>
      <p>
        Publicar como <strong>{creator.creator_nickname}</strong> (@
        {creator.creator_username}).
      </p>
      <label className="field">
        Privacidad
        <select
          required
          value={privacy}
          onChange={(e) => onPrivacy(e.target.value)}
        >
          <option value="">Selecciona la privacidad</option>
          {creator.privacy_level_options
            .filter((p) => p === "SELF_ONLY")
            .map((p) => (
              <option key={p} value={p}>
                Solo yo
              </option>
            ))}
        </select>
      </label>
      <p>
        Esta versión solo permite «Solo yo» cuando TikTok lo autoriza. La
        aplicación no se presenta como auditada. Máximo actual:{" "}
        {creator.max_video_post_duration_sec} segundos.
      </p>
      {(
        [
          ["comment", "Permitir comentarios", creator.comment_disabled],
          ["duet", "Permitir Duet", creator.duet_disabled],
          ["stitch", "Permitir Stitch", creator.stitch_disabled],
        ] as const
      ).map(([key, label, disabled]) => (
        <label key={key} className="consent">
          <input
            type="checkbox"
            checked={value[key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
          {disabled ? " · Restringido por TikTok" : ""}
        </label>
      ))}
      <label className="consent">
        <input
          type="checkbox"
          checked={value.brand_organic_toggle}
          onChange={(e) =>
            onChange({ ...value, brand_organic_toggle: e.target.checked })
          }
        />
        Este contenido promociona mi marca, producto o negocio
      </label>
      {value.brand_organic_toggle && (
        <p>Tu vídeo se etiquetará como contenido promocional.</p>
      )}
      <label className="consent">
        <input type="checkbox" disabled checked={false} readOnly />
        Contenido de marca para terceros · no disponible con «Solo yo»
      </label>
      <p>
        Si promocionas a un tercero, no envíes este vídeo mediante Direct Post
        privado. TikTok exige una privacidad compatible con contenido de marca.
      </p>
      <label className="consent">
        <input
          type="checkbox"
          checked={value.video_made_with_ai}
          onChange={(e) =>
            onChange({ ...value, video_made_with_ai: e.target.checked })
          }
        />
        Etiquetar como contenido generado con IA
      </label>
      <label className="consent">
        <input
          type="checkbox"
          required
          checked={music}
          onChange={(e) => onMusic(e.target.checked)}
        />
        Al publicar, acepto la{" "}
        <a
          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
          target="_blank"
          rel="noopener noreferrer"
        >
          Confirmación de uso de música de TikTok
        </a>
        .
      </label>
    </div>
  );
}
