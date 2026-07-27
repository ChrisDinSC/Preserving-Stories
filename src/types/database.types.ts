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
      };
      archive_invitations: {
        Row: {
          id: string;
          archive_id: string;
          email: string;
          role: ArchiveRole;
          token: string;
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          archive_id: string;
          email: string;
          role: ArchiveRole;
          token: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          archive_id?: string;
          email?: string;
          role?: ArchiveRole;
          token?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
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
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      story_status: StoryStatus;
      story_privacy: StoryPrivacy;
      archive_role: ArchiveRole;
    };
  };
}
