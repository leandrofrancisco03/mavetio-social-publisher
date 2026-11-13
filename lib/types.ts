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
    return "Enviado a TikTok · completar en la app";
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
