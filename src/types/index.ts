import type { Database } from "./database.types";

export type { Database, StoryStatus, StoryPrivacy, ArchiveRole } from "./database.types";

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

/** A navigation destination used by the sidebar and mobile bottom nav. */
export interface NavItem {
  label: string;
  href: string;
  /** lucide-react icon name resolved by the layout components. */
  icon: "dashboard" | "library" | "record" | "archive" | "account";
}
