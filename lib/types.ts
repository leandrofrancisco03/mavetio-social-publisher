export type Integration = {
  id: string;
  name: string;
  identifier: string;
  disabled: boolean;
  profile?: string;
};
export type SocialPost = {
  id: string;
  content: string;
  state: string;
  publishDate: string;
  error?: string | null;
  releaseURL?: string;
  settings?: { content_posting_method?: string };
  integration?: { name?: string; providerIdentifier?: string };
};
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
    post.settings?.content_posting_method === "UPLOAD"
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
