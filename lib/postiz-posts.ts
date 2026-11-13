import { z } from "zod";

// Postiz v2.25.3 serializes settings in GET /posts. Retain the wire value;
// tolerate object responses as before, without parsing JSON at this boundary.
export const postizPostsSchema = z.object({
  posts: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      publishDate: z.string(),
      state: z.string(), // Preserve provider states, including future additions.
      releaseURL: z.string().nullish(),
      releaseId: z.string().nullish(),
      error: z.string().nullish(),
      intervalInDays: z.number().nullish(),
      group: z.string().optional(),
      creationMethod: z.string().optional(),
      settings: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .nullish(),
      tags: z.array(z.unknown()).optional(),
      integration: z
        .object({
          id: z.string().optional(),
          providerIdentifier: z.string().optional(),
          name: z.string().optional(),
          picture: z.string().nullish(),
        })
        .nullish(),
    }),
  ),
});
export type PostizPost = z.infer<typeof postizPostsSchema>["posts"][number];
