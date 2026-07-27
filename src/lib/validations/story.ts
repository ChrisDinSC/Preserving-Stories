import { z } from "zod";

export const storyStatusEnum = z.enum(["draft", "published"]);
export const storyPrivacyEnum = z.enum([
  "private",
  "archive_members",
  "selected_members",
]);

export const storySchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  storyteller: z.string().max(120, "Name is too long").optional().or(z.literal("")),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  dateLabel: z.string().max(120).optional().or(z.literal("")),
  dateApproximate: z.string().optional().or(z.literal("")),
  status: storyStatusEnum.default("draft"),
  privacy: storyPrivacyEnum.default("private"),
  people: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
});

export const archiveSchema = z.object({
  name: z.string().min(1, "Archive name is required").max(120, "Name is too long"),
  description: z
    .string()
    .max(1000, "Description is too long")
    .optional()
    .or(z.literal("")),
});

export type StoryInput = z.infer<typeof storySchema>;
export type ArchiveInput = z.infer<typeof archiveSchema>;
