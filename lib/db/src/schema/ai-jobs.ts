import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspacesTable } from "./organizations";

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "draft", "queued", "running", "succeeded", "failed", "cancelled", "blocked", "setup_required"
]);

export const aiJobsTable = pgTable("ai_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  projectId: varchar("project_id"),
  taskType: varchar("task_type", { length: 100 }).notNull(),
  status: aiJobStatusEnum("status").notNull().default("draft"),
  providerKey: varchar("provider_key", { length: 100 }),
  modelKey: varchar("model_key", { length: 200 }),
  prompt: text("prompt"),
  negativePrompt: text("negative_prompt"),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().default({}),
  referenceAssetIds: jsonb("reference_asset_ids").$type<string[]>().notNull().default([]),
  outputAssetIds: jsonb("output_asset_ids").$type<string[]>().notNull().default([]),
  creditsEstimated: real("credits_estimated").notNull().default(0),
  creditsFinal: real("credits_final"),
  errorMessage: text("error_message"),
  setupRequiredInfo: jsonb("setup_required_info").$type<Record<string, unknown>>(),
  progressPercent: real("progress_percent"),
  providerJobId: varchar("provider_job_id"),
  idempotencyKey: varchar("idempotency_key").unique(),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_ai_job_workspace").on(t.workspaceId),
  index("idx_ai_job_project").on(t.projectId),
  index("idx_ai_job_status").on(t.status),
  index("idx_ai_job_created").on(t.createdAt),
]);

export type AiJob = typeof aiJobsTable.$inferSelect;
export type InsertAiJob = typeof aiJobsTable.$inferInsert;
