import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseTables() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DO $$
    BEGIN
      CREATE TYPE project_type AS ENUM (
        'video',
        'image',
        'carousel',
        'ad',
        'thumbnail',
        'product_mockup',
        'campaign',
        'template',
        'asset_only'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE project_status AS ENUM (
        'draft',
        'in_progress',
        'review',
        'approved',
        'published',
        'archived'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE asset_type AS ENUM (
        'image',
        'video',
        'audio',
        'document',
        'other'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE asset_source AS ENUM (
        'uploaded',
        'generated',
        'stock',
        'licensed'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE ai_job_status AS ENUM (
        'draft',
        'queued',
        'running',
        'succeeded',
        'failed',
        'cancelled',
        'blocked',
        'setup_required'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE social_platform AS ENUM (
        'youtube',
        'tiktok',
        'instagram',
        'facebook',
        'linkedin',
        'twitter',
        'pinterest'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE social_account_status AS ENUM (
        'active',
        'expired',
        'revoked',
        'error'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE publishing_status AS ENUM (
        'draft',
        'preflight_pending',
        'preflight_passed',
        'preflight_failed',
        'scheduled',
        'publishing',
        'published',
        'failed',
        'cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS sessions (
      sid text PRIMARY KEY,
      sess jsonb NOT NULL,
      expire timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email text UNIQUE,
      password_hash text,
      password_salt text,
      first_name text,
      last_name text,
      profile_image_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      slug text UNIQUE,
      logo_url text,
      plan text NOT NULL DEFAULT 'free',
      owner_id text NOT NULL,
      credits_balance real NOT NULL DEFAULT 100,
      stripe_customer_id text,
      stripe_subscription_id text,
      seats integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'editor',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_membership_user ON memberships (user_id);
    CREATE INDEX IF NOT EXISTS idx_membership_org ON memberships (org_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_user_org_unique
      ON memberships (user_id, org_id);

    CREATE TABLE IF NOT EXISTS workspaces (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      default_brand_kit_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_org ON workspaces (org_id);

    CREATE TABLE IF NOT EXISTS brand_kits (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name text NOT NULL,
      colors jsonb NOT NULL DEFAULT '[]'::jsonb,
      fonts jsonb NOT NULL DEFAULT '[]'::jsonb,
      logo_url text,
      tone text,
      audience text,
      forbidden_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
      style_notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_brand_kit_workspace ON brand_kits (workspace_id);

    CREATE TABLE IF NOT EXISTS activity_log (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text,
      user_id text,
      project_id text,
      asset_id text,
      type text NOT NULL,
      message text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_log (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at);

    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name text NOT NULL,
      type project_type NOT NULL DEFAULT 'video',
      status project_status NOT NULL DEFAULT 'draft',
      platform text,
      aspect_ratio text,
      duration real,
      language text DEFAULT 'en',
      brand_kit_id text,
      thumbnail_url text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_archived boolean NOT NULL DEFAULT false,
      created_by_id text NOT NULL,
      campaign_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_project_workspace ON projects (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_project_status ON projects (status);
    CREATE INDEX IF NOT EXISTS idx_project_type ON projects (type);
    CREATE INDEX IF NOT EXISTS idx_project_archived ON projects (is_archived);

    CREATE TABLE IF NOT EXISTS timelines (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id text NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      duration_ms real NOT NULL DEFAULT 0,
      tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
      captions jsonb NOT NULL DEFAULT '[]'::jsonb,
      audio_mix jsonb DEFAULT '{}'::jsonb,
      export_settings jsonb DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS canvases (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id text NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      pages jsonb NOT NULL DEFAULT '[]'::jsonb,
      shared_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
      brand_kit_id text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS project_plans (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id text NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
      script jsonb,
      scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
      layout_plan jsonb,
      prompt_pack jsonb NOT NULL DEFAULT '[]'::jsonb,
      credit_estimate real NOT NULL DEFAULT 0,
      safety_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS templates (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text,
      name text NOT NULL,
      type text NOT NULL,
      category text NOT NULL,
      thumbnail_url text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_system boolean NOT NULL DEFAULT false,
      is_brand_locked boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS assets (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name text NOT NULL,
      type asset_type NOT NULL,
      url text NOT NULL,
      thumbnail_url text,
      mime_type text,
      file_size real,
      width real,
      height real,
      duration real,
      source asset_source NOT NULL DEFAULT 'uploaded',
      ai_generated boolean NOT NULL DEFAULT false,
      provider_key text,
      model_key text,
      prompt_id text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      folder text,
      is_favorite boolean NOT NULL DEFAULT false,
      is_deleted boolean NOT NULL DEFAULT false,
      commercial_use_allowed boolean,
      rights_metadata jsonb DEFAULT '{}'::jsonb,
      created_by_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_asset_workspace ON assets (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_asset_type ON assets (type);
    CREATE INDEX IF NOT EXISTS idx_asset_source ON assets (source);
    CREATE INDEX IF NOT EXISTS idx_asset_folder ON assets (folder);

    CREATE TABLE IF NOT EXISTS ai_jobs (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id text,
      task_type text NOT NULL,
      status ai_job_status NOT NULL DEFAULT 'draft',
      provider_key text,
      model_key text,
      prompt text,
      negative_prompt text,
      parameters jsonb DEFAULT '{}'::jsonb,
      reference_asset_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      output_asset_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      credits_estimated real NOT NULL DEFAULT 0,
      credits_final real,
      error_message text,
      setup_required_info jsonb,
      progress_percent real,
      provider_job_id text,
      idempotency_key text UNIQUE,
      created_by_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_ai_job_workspace ON ai_jobs (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_ai_job_project ON ai_jobs (project_id);
    CREATE INDEX IF NOT EXISTS idx_ai_job_status ON ai_jobs (status);
    CREATE INDEX IF NOT EXISTS idx_ai_job_created ON ai_jobs (created_at);

    CREATE TABLE IF NOT EXISTS social_accounts (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      platform social_platform NOT NULL,
      account_name text NOT NULL,
      account_id text NOT NULL,
      avatar_url text,
      status social_account_status NOT NULL DEFAULT 'active',
      scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
      access_token text,
      refresh_token text,
      token_expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_social_account_workspace ON social_accounts (workspace_id);

    CREATE TABLE IF NOT EXISTS publishing_jobs (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id text NOT NULL,
      asset_id text,
      social_account_id text,
      platform social_platform NOT NULL,
      status publishing_status NOT NULL DEFAULT 'draft',
      scheduled_at timestamptz,
      published_at timestamptz,
      platform_post_id text,
      metadata jsonb DEFAULT '{}'::jsonb,
      preflight_result jsonb,
      error_message text,
      idempotency_key text UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_pub_job_workspace ON publishing_jobs (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_pub_job_project ON publishing_jobs (project_id);
    CREATE INDEX IF NOT EXISTS idx_pub_job_status ON publishing_jobs (status);
    CREATE INDEX IF NOT EXISTS idx_pub_job_scheduled ON publishing_jobs (scheduled_at);

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      workspace_id text,
      user_id text,
      job_id text,
      job_type text NOT NULL,
      credits real NOT NULL,
      description text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_usage_org ON usage_ledger (org_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_ledger (created_at);

    CREATE TABLE IF NOT EXISTS invoices (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      stripe_invoice_id text,
      amount real NOT NULL,
      currency text NOT NULL DEFAULT 'usd',
      status text NOT NULL,
      pdf_url text,
      period_start timestamptz,
      period_end timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_org ON invoices (org_id);

    CREATE TABLE IF NOT EXISTS provider_configs (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider_key text NOT NULL,
      name text,
      encrypted_api_key text,
      configured boolean NOT NULL DEFAULT false,
      is_default boolean NOT NULL DEFAULT false,
      priority integer NOT NULL DEFAULT 0,
      task_types jsonb NOT NULL DEFAULT '[]'::jsonb,
      daily_limit integer,
      allowed_models jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_provider_org ON provider_configs (org_id);

    CREATE TABLE IF NOT EXISTS post_metrics (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id text NOT NULL,
      project_id text NOT NULL,
      publishing_job_id text,
      platform text NOT NULL,
      platform_post_id text,
      views real,
      likes real,
      comments real,
      shares real,
      saves real,
      watch_time real,
      impressions real,
      reach real,
      click_through real,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_post_metrics_workspace ON post_metrics (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_post_metrics_project ON post_metrics (project_id);

    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE organizations ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE memberships ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE workspaces ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE brand_kits ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE activity_log ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE projects ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE timelines ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE canvases ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE project_plans ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE templates ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE assets ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE ai_jobs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE social_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE publishing_jobs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE usage_ledger ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE invoices ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE provider_configs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE post_metrics ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  `);
}

export * from "./schema";