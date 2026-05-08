import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspacesTable } from "./organizations";

export const projectTypeEnum = pgEnum("project_type", [
  "video", "image", "carousel", "ad", "thumbnail", "product_mockup", "campaign", "template", "asset_only"
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft", "in_progress", "review", "approved", "published", "archived"
]);

export const projectsTable = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: projectTypeEnum("type").notNull().default("video"),
  status: projectStatusEnum("status").notNull().default("draft"),
  platform: varchar("platform", { length: 100 }),
  aspectRatio: varchar("aspect_ratio", { length: 20 }),
  duration: real("duration"),
  language: varchar("language", { length: 20 }).default("en"),
  brandKitId: varchar("brand_kit_id"),
  thumbnailUrl: text("thumbnail_url"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  isArchived: boolean("is_archived").notNull().default(false),
  createdById: varchar("created_by_id").notNull(),
  campaignId: varchar("campaign_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_project_workspace").on(t.workspaceId),
  index("idx_project_status").on(t.status),
  index("idx_project_type").on(t.type),
  index("idx_project_archived").on(t.isArchived),
]);

export const timelinesTable = pgTable("timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }).unique(),
  version: integer("version").notNull().default(1),
  durationMs: real("duration_ms").notNull().default(0),
  tracks: jsonb("tracks").$type<unknown[]>().notNull().default([]),
  captions: jsonb("captions").$type<unknown[]>().notNull().default([]),
  audioMix: jsonb("audio_mix").$type<Record<string, unknown>>().default({}),
  exportSettings: jsonb("export_settings").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const canvasesTable = pgTable("canvases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }).unique(),
  version: integer("version").notNull().default(1),
  pages: jsonb("pages").$type<unknown[]>().notNull().default([]),
  sharedAssets: jsonb("shared_assets").$type<string[]>().notNull().default([]),
  brandKitId: varchar("brand_kit_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectPlansTable = pgTable("project_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }).unique(),
  hooks: jsonb("hooks").$type<unknown[]>().notNull().default([]),
  script: jsonb("script").$type<Record<string, unknown>>(),
  scenes: jsonb("scenes").$type<unknown[]>().notNull().default([]),
  layoutPlan: jsonb("layout_plan").$type<Record<string, unknown>>(),
  promptPack: jsonb("prompt_pack").$type<unknown[]>().notNull().default([]),
  creditEstimate: real("credit_estimate").notNull().default(0),
  safetyWarnings: jsonb("safety_warnings").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const templatesTable = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id"),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  isSystem: boolean("is_system").notNull().default(false),
  isBrandLocked: boolean("is_brand_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
export type Timeline = typeof timelinesTable.$inferSelect;
export type Canvas = typeof canvasesTable.$inferSelect;
export type ProjectPlan = typeof projectPlansTable.$inferSelect;
export type Template = typeof templatesTable.$inferSelect;
