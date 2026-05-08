import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspacesTable } from "./organizations";

export const socialPlatformEnum = pgEnum("social_platform", [
  "youtube", "tiktok", "instagram", "facebook", "linkedin", "twitter", "pinterest"
]);

export const socialAccountStatusEnum = pgEnum("social_account_status", [
  "active", "expired", "revoked", "error"
]);

export const publishingStatusEnum = pgEnum("publishing_status", [
  "draft", "preflight_pending", "preflight_passed", "preflight_failed",
  "scheduled", "publishing", "published", "failed", "cancelled"
]);

export const socialAccountsTable = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  platform: socialPlatformEnum("platform").notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  status: socialAccountStatusEnum("status").notNull().default("active"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("idx_social_account_workspace").on(t.workspaceId)]);

export const publishingJobsTable = pgTable("publishing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull(),
  assetId: varchar("asset_id"),
  socialAccountId: varchar("social_account_id"),
  platform: socialPlatformEnum("platform").notNull(),
  status: publishingStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  platformPostId: varchar("platform_post_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  preflightResult: jsonb("preflight_result").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  idempotencyKey: varchar("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_pub_job_workspace").on(t.workspaceId),
  index("idx_pub_job_project").on(t.projectId),
  index("idx_pub_job_status").on(t.status),
  index("idx_pub_job_scheduled").on(t.scheduledAt),
]);

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
export type InsertSocialAccount = typeof socialAccountsTable.$inferInsert;
export type PublishingJob = typeof publishingJobsTable.$inferSelect;
export type InsertPublishingJob = typeof publishingJobsTable.$inferInsert;
