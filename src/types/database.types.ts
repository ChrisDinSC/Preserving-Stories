/**
 * Typed representation of the Supabase (PostgreSQL) schema defined in
 * supabase/migrations/001_initial_schema.sql. This is hand-authored for Phase 1;
 * once the schema is applied you can regenerate it with the Supabase CLI:
 *
 *   supabase gen types typescript --project-id <id> > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StoryStatus = "draft" | "published";
export type StoryPrivacy = "private" | "archive_members" | "selected_members";
export type ArchiveRole = "owner" | "contributor" | "viewer";
/** Roles that can be assigned via invitation or role change (never "owner"). */
export type AssignableRole = "contributor" | "viewer";
export type InvitationStatus =
  | "valid"
  | "accepted"
  | "revoked"
  | "expired"
  | "wrong_email"
  | "invalid";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archives: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archive_members: {
        Row: {
          id: string;
          archive_id: string;
          user_id: string;
          role: ArchiveRole;
          invited_by: string | null;
          joined_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          archive_id: string;
          user_id: string;
          role: ArchiveRole;
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          archive_id?: string;
          user_id?: string;
          role?: ArchiveRole;
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      archive_invitations: {
        Row: {
          id: string;
          archive_id: string;
          email: string;
          role: AssignableRole;
          token_hash: string;
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          archive_id: string;
          email: string;
          role: AssignableRole;
          token_hash: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          archive_id?: string;
          email?: string;
          role?: AssignableRole;
          token_hash?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          id: string;
          archive_id: string;
          title: string;
          storyteller: string | null;
          description: string | null;
          audio_url: string | null;
          transcript: string | null;
          date_label: string | null;
          date_approximate: string | null;
          status: StoryStatus;
          privacy: StoryPrivacy;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          archive_id: string;
          title: string;
          storyteller?: string | null;
          description?: string | null;
          audio_url?: string | null;
          transcript?: string | null;
          date_label?: string | null;
          date_approximate?: string | null;
          status?: StoryStatus;
          privacy?: StoryPrivacy;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          archive_id?: string;
          title?: string;
          storyteller?: string | null;
          description?: string | null;
          audio_url?: string | null;
          transcript?: string | null;
          date_label?: string | null;
          date_approximate?: string | null;
          status?: StoryStatus;
          privacy?: StoryPrivacy;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      story_people: {
        Row: {
          id: string;
          story_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          story_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          story_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          archive_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          archive_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          archive_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      story_tags: {
        Row: {
          story_id: string;
          tag_id: string;
        };
        Insert: {
          story_id: string;
          tag_id: string;
        };
        Update: {
          story_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      story_permissions: {
        Row: {
          id: string;
          story_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          story_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          story_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      shares_archive_with: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_archive_member: {
        Args: { p_archive_id: string };
        Returns: boolean;
      };
      is_archive_owner: {
        Args: { p_archive_id: string };
        Returns: boolean;
      };
      can_contribute_to_archive: {
        Args: { p_archive_id: string };
        Returns: boolean;
      };
      can_view_story: {
        Args: { p_story_id: string };
        Returns: boolean;
      };
      create_archive_with_owner: {
        Args: { p_name: string; p_description: string | null };
        Returns: string;
      };
      get_archive_members: {
        Args: { p_archive_id: string };
        Returns: {
          id: string;
          user_id: string;
          role: ArchiveRole;
          joined_at: string | null;
          created_at: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
        }[];
      };
      create_invitation: {
        Args: {
          p_archive_id: string;
          p_email: string;
          p_role: string;
          p_token_hash: string;
          p_expires_at: string | null;
        };
        Returns: string;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_invitation_by_token: {
        Args: { p_token_hash: string };
        Returns: {
          invitation_id: string | null;
          archive_id: string | null;
          archive_name: string | null;
          role: ArchiveRole | null;
          email: string | null;
          status: InvitationStatus;
          inviter_name: string | null;
        }[];
      };
      accept_invitation: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      update_member_role: {
        Args: { p_member_id: string; p_role: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      story_status: StoryStatus;
      story_privacy: StoryPrivacy;
      archive_role: ArchiveRole;
    };
  };
}
