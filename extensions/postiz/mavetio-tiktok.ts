// Shared, token-free response contract. Copied into the custom Postiz build.
export const CONTRACT = "mavetio-tiktok-v1" as const;
export type Creator = {
  contract: typeof CONTRACT;
  checkedAt: string;
  creator_nickname: string;
  creator_username: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
};
export class CreatorError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "CreatorError";
  }
}
export async function creatorForOrganization(
  org: string,
  id: string,
  find: (
    org: string,
    id: string,
  ) => Promise<{
    organizationId: string;
    providerIdentifier: string;
    token: string;
    disabled: boolean;
    deletedAt?: unknown;
    refreshNeeded?: boolean;
  } | null>,
  fetcher: typeof fetch = fetch,
) {
  const channel = await find(org, id);
  if (
    !channel ||
    channel.organizationId !== org ||
    channel.providerIdentifier !== "tiktok" ||
    channel.disabled ||
    channel.deletedAt ||
    channel.refreshNeeded ||
    !channel.token
  )
    throw new CreatorError("CHANNEL_UNAVAILABLE");
  return queryCreator(channel.token, fetcher);
}
export function parseCreator(value: unknown): Creator {
  const v = value as Creator;
  if (
    !v ||
    v.contract !== CONTRACT ||
    typeof v.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(v.checkedAt)) ||
    Date.now() - Date.parse(v.checkedAt) > 120000 ||
    Date.parse(v.checkedAt) > Date.now() + 10000 ||
    typeof v.creator_nickname !== "string" ||
    !v.creator_nickname ||
    typeof v.creator_username !== "string" ||
    !Array.isArray(v.privacy_level_options) ||
    !v.privacy_level_options.every((p) => typeof p === "string") ||
    ![v.comment_disabled, v.duet_disabled, v.stitch_disabled].every(
      (p) => typeof p === "boolean",
    ) ||
    !Number.isFinite(v.max_video_post_duration_sec) ||
    v.max_video_post_duration_sec <= 0
  )
    throw new CreatorError("CREATOR_INVALID");
  // Return an allowlist only: never forward an unexpected upstream field.
  return {
    contract: CONTRACT,
    checkedAt: v.checkedAt,
    creator_nickname: v.creator_nickname,
    creator_username: v.creator_username,
    privacy_level_options: v.privacy_level_options.filter(
      (p) => p === "SELF_ONLY",
    ),
    comment_disabled: v.comment_disabled,
    duet_disabled: v.duet_disabled,
    stitch_disabled: v.stitch_disabled,
    max_video_post_duration_sec: v.max_video_post_duration_sec,
  };
}
export async function queryCreator(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<Creator> {
  let response: Response;
  try {
    response = await fetcher(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new CreatorError("CREATOR_UNREACHABLE");
  }
  if (!response.ok)
    throw new CreatorError(
      response.status === 401 || response.status === 403
        ? "CREATOR_NOT_AUTHORIZED"
        : "CREATOR_UNAVAILABLE",
    );
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new CreatorError("CREATOR_INVALID");
  }
  // Successful creator_info requires video.publish. Do not assume grant from connection status.
  if (json?.error?.code !== "ok")
    throw new CreatorError("CREATOR_NOT_AUTHORIZED");
  // TikTok documents FOLLOWER_OF_CREATOR for private accounts and
  // PUBLIC_TO_EVERYONE for public ones. Unaudited clients require private
  // accounts too; fail closed if these options cannot establish that condition.
  const options = json?.data?.privacy_level_options;
  if (
    !Array.isArray(options) ||
    !options.includes("FOLLOWER_OF_CREATOR") ||
    options.includes("PUBLIC_TO_EVERYONE")
  )
    throw new CreatorError("PRIVATE_ACCOUNT_REQUIRED");
  return parseCreator({
    ...json.data,
    contract: CONTRACT,
    checkedAt: new Date().toISOString(),
  });
}
export type DirectSettings = {
  privacy_level: "SELF_ONLY";
  comment: boolean;
  duet: boolean;
  stitch: boolean;
  brand_content_toggle: boolean;
  brand_organic_toggle: boolean;
  video_made_with_ai: boolean;
};
export function validateDirect(
  settings: DirectSettings,
  creator: Creator,
  duration?: number,
) {
  const c = parseCreator(creator);
  if (
    settings.privacy_level !== "SELF_ONLY" ||
    !c.privacy_level_options.includes("SELF_ONLY")
  )
    throw new CreatorError("PRIVACY_NOT_ALLOWED");
  if (
    [
      settings.comment,
      settings.duet,
      settings.stitch,
      settings.brand_content_toggle,
      settings.brand_organic_toggle,
      settings.video_made_with_ai,
    ].some((v) => typeof v !== "boolean")
  )
    throw new CreatorError("SETTINGS_INVALID");
  if (
    (settings.comment && c.comment_disabled) ||
    (settings.duet && c.duet_disabled) ||
    (settings.stitch && c.stitch_disabled)
  )
    throw new CreatorError("INTERACTION_NOT_ALLOWED");
  if (settings.brand_content_toggle)
    throw new CreatorError("BRANDED_CONTENT_REQUIRES_NON_PRIVATE");
  if (
    duration !== undefined &&
    (!Number.isFinite(duration) ||
      duration <= 0 ||
      duration > c.max_video_post_duration_sec)
  )
    throw new CreatorError("VIDEO_TOO_LONG");
}
