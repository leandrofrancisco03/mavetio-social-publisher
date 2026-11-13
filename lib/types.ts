export type Integration = {
  id: string;
  name: string;
  identifier: string;
  disabled: boolean;
  profile?: string;
};
export type SocialPost = import("./postiz-posts").PostizPost;
export type PublicConfig = {
  postizConfigured: boolean;
  storageConfigured: boolean;
  postizWebUrl: string;
  sandbox: boolean;
};
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export function postLabel(post: SocialPost) {
  if (
    post.state === "PUBLISHED" &&
    readPostSettings(post.settings)?.content_posting_method === "UPLOAD"
  )
    return "Completado según Postiz · UPLOAD";
  return (
    (
      {
        QUEUE: "En cola",
        PUBLISHED: "Publicado según Postiz",
        ERROR: "Error",
        DRAFT: "Borrador",
      } as Record<string, string>
    )[post.state] || post.state
  );
}

export function postDeliveryDetail(post: SocialPost): string | null {
  if (
    readPostSettings(post.settings)?.content_posting_method === "DIRECT_POST"
  ) {
    switch (post.state) {
      case "PUBLISHED":
        return "Publicado según Postiz mediante Direct Post. Mavetio no ha consultado directamente TikTok para confirmar su visibilidad.";
      case "QUEUE":
        return "Direct Post programado, en cola o procesándose según Postiz. Aún no consta publicación completada.";
      case "DRAFT":
        return "Borrador Direct Post en Postiz; no acredita publicación.";
      case "ERROR":
        return "Postiz informa un error en Direct Post. Puede haber fallado o quedar sin confirmar; revisa TikTok antes de reenviar.";
      default:
        return "Resultado de Direct Post desconocido. Revisa Postiz y TikTok antes de reenviar.";
    }
  }
  if (readPostSettings(post.settings)?.content_posting_method !== "UPLOAD")
    return null;
  switch (post.state) {
    case "DRAFT":
      return "Borrador en Postiz. No solicitado para entrega a TikTok.";
    case "QUEUE":
      return "En cola o procesándose en Postiz. Entrega a la bandeja todavía no confirmada.";
    case "ERROR":
      return "Postiz informa un error; la entrega puede haber fallado o quedar sin confirmar. Revisa el detalle y la bandeja antes de reenviar.";
    case "PUBLISHED":
      return "Postiz informa que terminó el flujo UPLOAD. Mavetio no consulta directamente el estado de TikTok. Comprueba la notificación y el vídeo en la bandeja; esto no acredita publicación en el perfil.";
    default:
      return "Estado de entrega no reconocido. Comprueba Postiz y TikTok antes de reenviar.";
  }
}

export function submissionNotice(action: string, ids: string[]) {
  const label =
    action === "draft"
      ? "Borrador guardado"
      : action === "schedule"
        ? "Solicitud programada aceptada"
        : "Solicitud de envío aceptada";
  return `${label} por Postiz. ID: ${ids.join(", ")}. ${action === "draft" ? "No se ha solicitado el envío a TikTok." : "Esta aceptación no confirma entrega a TikTok. Actualiza las publicaciones y comprueba la bandeja antes de reenviar."}`;
}

export function readPostSettings(
  settings: SocialPost["settings"],
): Record<string, unknown> | null {
  try {
    const parsed: unknown =
      typeof settings === "string" ? JSON.parse(settings) : settings;
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } // Do not log settings or fail the entire list.
}

export function postNetwork(post: SocialPost): string {
  const provider = post.integration?.providerIdentifier;
  return (
    (
      {
        tiktok: "TikTok",
        youtube: "YouTube",
        facebook: "Facebook",
        instagram: "Instagram",
      } as Record<string, string>
    )[provider || ""] ||
    provider ||
    "Red no informada"
  );
}

// Display conversion only, NOT an HTML sanitizer. Its result must always be
// rendered as a React text node, never as innerHTML (including decoded entities).
export function postContentText(content: string): string {
  return content
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>|<!--[\s\S]*?-->/gi, "")
    .replace(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (match, entity: string) => {
        const named: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
        };
        if (!entity.startsWith("#"))
          return named[entity.toLowerCase()] ?? match;
        const number = entity.toLowerCase().startsWith("#x")
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
        return number > 0 &&
          number <= 0x10ffff &&
          !(number >= 0xd800 && number <= 0xdfff)
          ? String.fromCodePoint(number)
          : match;
      },
    )
    .trim();
}
