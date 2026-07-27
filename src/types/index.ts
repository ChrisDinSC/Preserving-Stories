import type { Database } from "./database.types";

export type {
  Database,
  StoryStatus,
  StoryPrivacy,
  ArchiveRole,
  InvitationStatus,
} from "./database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Archive = Database["public"]["Tables"]["archives"]["Row"];
export type ArchiveMember = Database["public"]["Tables"]["archive_members"]["Row"];
export type ArchiveInvitation =
  Database["public"]["Tables"]["archive_invitations"]["Row"];
export type Story = Database["public"]["Tables"]["stories"]["Row"];
export type StoryPerson = Database["public"]["Tables"]["story_people"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type StoryTag = Database["public"]["Tables"]["story_tags"]["Row"];
export type StoryPermission =
  Database["public"]["Tables"]["story_permissions"]["Row"];

/** A member row enriched with the member's profile + email (from get_archive_members RPC). */
export type ArchiveMemberWithProfile =
  Database["public"]["Functions"]["get_archive_members"]["Returns"][number];

/** The shape returned by get_invitation_by_token RPC. */
export type InvitationLookup =
  Database["public"]["Functions"]["get_invitation_by_token"]["Returns"][number];

/** An archive paired with the current user's role in it. */
export interface ArchiveWithRole {
  archive: Archive;
  role: import("./database.types").ArchiveRole;
}

/** A navigation destination used by the sidebar and mobile bottom nav. */
export interface NavItem {
  label: string;
  href: string;
  /** lucide-react icon name resolved by the layout components. */
  icon: "dashboard" | "library" | "record" | "archive" | "account";
}
