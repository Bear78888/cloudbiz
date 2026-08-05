/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --db-url "$DATABASE_URL" \
 *     > src/lib/supabase/database.types.ts
 *
 * The `rls` job in CI regenerates this against a database built from
 * `supabase/migrations/**` and fails if the result differs. That is the point:
 * without the check the types drift after the first migration and go back to
 * being decoration.
 *
 * Why this file exists at all: the clients used to be untyped, so
 * `.select("lead_source")` on a table whose column is `source` passed
 * typecheck, passed every test, and surfaced as a silent 400 in production —
 * a query error that the calling code could not tell apart from "no rows".
 * With `Database` wired into every client that is a compile error.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admin_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          is_active: boolean;
          profile_id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          profile_id: string;
          role: string;
          updated_at?: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          profile_id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: string;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string | null;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      business_profiles: {
        Row: {
          business_hours: Json;
          created_at: string;
          display_name: string;
          email: string | null;
          google_review_url: string | null;
          logo_path: string | null;
          notification_settings: Json;
          organization_id: string;
          owner_name: string | null;
          phone: string | null;
          service_area: Json;
          services: Json;
          supported_locales: string[];
          updated_at: string;
          website_slug: string | null;
        };
        Insert: {
          business_hours?: Json;
          created_at?: string;
          display_name: string;
          email?: string | null;
          google_review_url?: string | null;
          logo_path?: string | null;
          notification_settings?: Json;
          organization_id: string;
          owner_name?: string | null;
          phone?: string | null;
          service_area?: Json;
          services?: Json;
          supported_locales?: string[];
          updated_at?: string;
          website_slug?: string | null;
        };
        Update: {
          business_hours?: Json;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          google_review_url?: string | null;
          logo_path?: string | null;
          notification_settings?: Json;
          organization_id?: string;
          owner_name?: string | null;
          phone?: string | null;
          service_area?: Json;
          services?: Json;
          supported_locales?: string[];
          updated_at?: string;
          website_slug?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          email_marketing_consent: boolean;
          email_unsubscribed_at: string | null;
          id: string;
          lead_source: string | null;
          name: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          phone_digits: string | null;
          preferred_locale: string;
          sms_consent: boolean;
          sms_consent_at: string | null;
          sms_consent_source: string | null;
          sms_opted_out_at: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_marketing_consent?: boolean;
          email_unsubscribed_at?: string | null;
          id?: string;
          lead_source?: string | null;
          name: string;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          phone_digits?: string | null;
          preferred_locale?: string;
          sms_consent?: boolean;
          sms_consent_at?: string | null;
          sms_consent_source?: string | null;
          sms_opted_out_at?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_marketing_consent?: boolean;
          email_unsubscribed_at?: string | null;
          id?: string;
          lead_source?: string | null;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          phone_digits?: string | null;
          preferred_locale?: string;
          sms_consent?: boolean;
          sms_consent_at?: string | null;
          sms_consent_source?: string | null;
          sms_opted_out_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      estimate_items: {
        Row: {
          id: string;
          estimate_id: string;
          organization_id: string;
          item_type: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          organization_id: string;
          item_type?: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          estimate_id?: string;
          organization_id?: string;
          item_type?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      estimates: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string | null;
          version: number;
          locale: string;
          status: string;
          subtotal: number;
          tax: number;
          tax_rate: number;
          total: number;
          title: string;
          scope: string | null;
          included_work: Json;
          exclusions: Json;
          terms: string | null;
          pdf_path: string | null;
          public_token: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          expires_at: string | null;
          ai_model: string | null;
          ai_prompt_version: string | null;
          ai_schema_version: string | null;
          ai_confidence: number | null;
          ai_generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id?: string | null;
          version?: number;
          locale?: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          tax_rate?: number;
          total?: number;
          title: string;
          scope?: string | null;
          included_work?: Json;
          exclusions?: Json;
          terms?: string | null;
          pdf_path?: string | null;
          public_token?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          expires_at?: string | null;
          ai_model?: string | null;
          ai_prompt_version?: string | null;
          ai_schema_version?: string | null;
          ai_confidence?: number | null;
          ai_generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          job_id?: string | null;
          version?: number;
          locale?: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          tax_rate?: number;
          total?: number;
          title?: string;
          scope?: string | null;
          included_work?: Json;
          exclusions?: Json;
          terms?: string | null;
          pdf_path?: string | null;
          public_token?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          expires_at?: string | null;
          ai_model?: string | null;
          ai_prompt_version?: string | null;
          ai_schema_version?: string | null;
          ai_confidence?: number | null;
          ai_generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entitlements: {
        Row: {
          created_at: string;
          feature_code: string;
          id: string;
          limits: Json;
          organization_id: string;
          source_subscription_id: string | null;
          status: string;
          updated_at: string;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string;
          feature_code: string;
          id?: string;
          limits?: Json;
          organization_id: string;
          source_subscription_id?: string | null;
          status?: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          feature_code?: string;
          id?: string;
          limits?: Json;
          organization_id?: string;
          source_subscription_id?: string | null;
          status?: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      google_connections: {
        Row: {
          connected_at: string;
          created_at: string;
          email: string | null;
          google_subject: string;
          id: string;
          last_error: string | null;
          organization_id: string;
          revoked_at: string | null;
          scopes: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          connected_at?: string;
          created_at?: string;
          email?: string | null;
          google_subject: string;
          id?: string;
          last_error?: string | null;
          organization_id: string;
          revoked_at?: string | null;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          connected_at?: string;
          created_at?: string;
          email?: string | null;
          google_subject?: string;
          id?: string;
          last_error?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_oauth_tokens: {
        Row: {
          connection_id: string;
          created_at: string;
          encrypted_refresh_token: string;
          key_version: number;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          encrypted_refresh_token: string;
          key_version?: number;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          encrypted_refresh_token?: string;
          key_version?: number;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_spreadsheets: {
        Row: {
          connection_id: string | null;
          created_at: string;
          id: string;
          last_error: string | null;
          last_full_sync_at: string | null;
          last_successful_sync_at: string | null;
          organization_id: string;
          schema_version: number;
          spreadsheet_id: string;
          spreadsheet_name: string;
          status: string;
          tab_mapping: Json;
          updated_at: string;
        };
        Insert: {
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_full_sync_at?: string | null;
          last_successful_sync_at?: string | null;
          organization_id: string;
          schema_version?: number;
          spreadsheet_id: string;
          spreadsheet_name: string;
          status?: string;
          tab_mapping?: Json;
          updated_at?: string;
        };
        Update: {
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_full_sync_at?: string | null;
          last_successful_sync_at?: string | null;
          organization_id?: string;
          schema_version?: number;
          spreadsheet_id?: string;
          spreadsheet_name?: string;
          status?: string;
          tab_mapping?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_activities: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          customer_id: string | null;
          event_type: string;
          id: string;
          job_id: string | null;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          customer_id?: string | null;
          event_type: string;
          id?: string;
          job_id?: string | null;
          metadata?: Json;
          organization_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          customer_id?: string | null;
          event_type?: string;
          id?: string;
          job_id?: string | null;
          metadata?: Json;
          organization_id?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          address: string | null;
          assigned_user_id: string | null;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          description: string | null;
          estimate_amount: number | null;
          id: string;
          job_total: number | null;
          last_follow_up_at: string | null;
          materials_cost: number | null;
          notes: string | null;
          organization_id: string;
          payment_status: string;
          priority: string;
          review_requested_at: string | null;
          scheduled_end: string | null;
          scheduled_start: string | null;
          service: string | null;
          source: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          assigned_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          estimate_amount?: number | null;
          id?: string;
          job_total?: number | null;
          last_follow_up_at?: string | null;
          materials_cost?: number | null;
          notes?: string | null;
          organization_id: string;
          payment_status?: string;
          priority?: string;
          review_requested_at?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          service?: string | null;
          source?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          assigned_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          estimate_amount?: number | null;
          id?: string;
          job_total?: number | null;
          last_follow_up_at?: string | null;
          materials_cost?: number | null;
          notes?: string | null;
          organization_id?: string;
          payment_status?: string;
          priority?: string;
          review_requested_at?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          service?: string | null;
          source?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_url: string | null;
          body: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          read_at: string | null;
          severity: string;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          action_url?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          read_at?: string | null;
          severity?: string;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          action_url?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          read_at?: string | null;
          severity?: string;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          created_at: string;
          invited_at: string | null;
          joined_at: string | null;
          organization_id: string;
          permissions: Json;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          invited_at?: string | null;
          joined_at?: string | null;
          organization_id: string;
          permissions?: Json;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_at?: string | null;
          joined_at?: string | null;
          organization_id?: string;
          permissions?: Json;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          created_at: string;
          currency: string;
          default_locale: string;
          deleted_at: string | null;
          id: string;
          name: string;
          slug: string;
          status: string;
          timezone: string;
          trade: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          timezone?: string;
          trade: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          timezone?: string;
          trade?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outbound_emails: {
        Row: {
          id: string;
          organization_id: string;
          kind: string;
          estimate_id: string | null;
          job_id: string | null;
          customer_id: string | null;
          to_email: string;
          subject: string;
          locale: string;
          provider: string;
          provider_message_id: string | null;
          status: string;
          error: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: string;
          estimate_id?: string | null;
          job_id?: string | null;
          customer_id?: string | null;
          to_email: string;
          subject: string;
          locale?: string;
          provider?: string;
          provider_message_id?: string | null;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          kind?: string;
          estimate_id?: string | null;
          job_id?: string | null;
          customer_id?: string | null;
          to_email?: string;
          subject?: string;
          locale?: string;
          provider?: string;
          provider_message_id?: string | null;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          email: string;
          id: string;
          owner_interface_locale: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email: string;
          id: string;
          owner_interface_locale?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string;
          id?: string;
          owner_interface_locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          organization_id: string;
          product_code: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          organization_id: string;
          product_code: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          organization_id?: string;
          product_code?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          idempotency_key: string;
          last_error: string | null;
          next_attempt_at: string;
          operation: string;
          organization_id: string;
          payload_version: number;
          processed_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          idempotency_key: string;
          last_error?: string | null;
          next_attempt_at?: string;
          operation: string;
          organization_id: string;
          payload_version?: number;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          idempotency_key?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          operation?: string;
          organization_id?: string;
          payload_version?: number;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          created_at: string;
          feature_code: string;
          id: string;
          idempotency_key: string;
          metadata: Json;
          occurred_at: string;
          organization_id: string;
          provider_cost: number | null;
          quantity: number;
        };
        Insert: {
          created_at?: string;
          feature_code: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          occurred_at?: string;
          organization_id: string;
          provider_cost?: number | null;
          quantity: number;
        };
        Update: {
          created_at?: string;
          feature_code?: string;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          occurred_at?: string;
          organization_id?: string;
          provider_cost?: number | null;
          quantity?: number;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          attempt_count: number;
          created_at: string;
          error_code: string | null;
          event_type: string;
          external_event_id: string;
          id: string;
          payload_hash: string;
          processed_at: string | null;
          processing_status: string;
          provider: string;
          received_at: string;
          sanitized_payload: Json;
          signature_verified: boolean;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          error_code?: string | null;
          event_type: string;
          external_event_id: string;
          id?: string;
          payload_hash: string;
          processed_at?: string | null;
          processing_status?: string;
          provider: string;
          received_at?: string;
          sanitized_payload?: Json;
          signature_verified?: boolean;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          error_code?: string | null;
          event_type?: string;
          external_event_id?: string;
          id?: string;
          payload_hash?: string;
          processed_at?: string | null;
          processing_status?: string;
          provider?: string;
          received_at?: string;
          sanitized_payload?: Json;
          signature_verified?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: {
        Args: {
          org_default_locale?: string;
          org_name: string;
          org_timezone?: string;
          org_trade: string;
        };
        Returns: string;
      };
      import_jobs: {
        Args: { p_organization_id: string; p_rows: Json };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DefaultSchema = Database["public"];

export type Tables<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name]["Row"];

export type TablesInsert<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name]["Insert"];

export type TablesUpdate<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name]["Update"];
