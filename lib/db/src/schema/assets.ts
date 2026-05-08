import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspacesTable } from "./organizations";

export const assetTypeEnum = pgEnum("asset_type", [
  "image", "video", "audio", "document", "other"
]);

export const assetSourceEnum = pgEnum("asset_source", [
  "uploaded", "generated", "stock", "licensed"
]);

export const assetsTable = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: assetTypeEnum("type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: real("file_size"),
  width: real("width"),
  height: real("height"),
  duration: real("duration"),
  source: assetSourceEnum("source").notNull().default("uploaded"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  providerKey: varchar("provider_key", { length: 100 }),
  modelKey: varchar("model_key", { length: 200 }),
  promptId: varchar("prompt_id"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  folder: varchar("folder", { length: 500 }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  commercialUseAllowed: boolean("commercial_use_allowed"),
  rightsMetadata: jsonb("rights_metadata").$type<Record<string, unknown>>().default({}),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_asset_workspace").on(t.workspaceId),
  index("idx_asset_type").on(t.type),
  index("idx_asset_source").on(t.source),
  index("idx_asset_folder").on(t.folder),
]);

export type Asset = typeof assetsTable.$inferSelect;
export type InsertAsset = typeof assetsTable.$inferInsert;
