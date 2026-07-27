import { z } from "zod";

/**
 * Zod schemas for archive creation/editing and member management.
 * Shared by React Hook Form (client) and the server actions (server-side
 * re-validation — never trust the client).
 */

export const archiveSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter an archive name.")
    .max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type ArchiveInput = z.infer<typeof archiveSchema>;

/** Roles that can be assigned to invited/existing members (never "owner"). */
export const assignableRoleEnum = z.enum(["contributor", "viewer"]);

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter an email address.")
    .email("Please enter a valid email address."),
  role: assignableRoleEnum,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: assignableRoleEnum,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
