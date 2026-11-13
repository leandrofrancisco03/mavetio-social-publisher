import { z } from "zod";
export const submissionSchema = z
  .object({
    requestId: z.uuid(),
    integrationId: z.string().min(1).max(200),
    title: z.string().trim().min(1).max(90),
    description: z.string().trim().max(1800),
    action: z.enum(["now", "schedule", "draft"]),
    date: z.iso.datetime().optional(),
    method: z.literal("UPLOAD"),
    mediaReceipt: z.string().min(20).max(10000),
    consent: z.literal(true),
  })
  .strict();
export type Submission = z.infer<typeof submissionSchema>;
export function buildPost(
  input: Submission,
  media: { id: string; path: string },
) {
  return {
    type: input.action,
    date: input.date || new Date().toISOString(),
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: input.integrationId },
        value: [
          {
            content: [input.title, input.description]
              .filter(Boolean)
              .join("\n\n"),
            image: [media],
          },
        ],
        settings: {
          __type: "tiktok",
          title: input.title,
          privacy_level: "SELF_ONLY",
          duet: false,
          stitch: false,
          comment: false,
          autoAddMusic: "no",
          brand_content_toggle: false,
          brand_organic_toggle: false,
          video_made_with_ai: false,
          content_posting_method: "UPLOAD",
        },
      },
    ],
  };
}
