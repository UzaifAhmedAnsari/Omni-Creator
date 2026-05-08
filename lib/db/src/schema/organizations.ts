import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  logoUrl: text("logo_url"),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  ownerId: varchar("owner_id").notNull(),
  creditsBalance: real("credits_balance").notNull().default(100),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  seats: integer("seats").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workspacesTable = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  defaultBrandKitId: varchar("default_brand_kit_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("idx_workspace_org").on(t.orgId)]);

export const membershipsTable = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_membership_user").on(t.userId),
  index("idx_membership_org").on(t.orgId),
]);

export const brandKitsTable = pgTable("brand_kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  colors: jsonb("colors").$type<string[]>().notNull().default([]),
  fonts: jsonb("fonts").$type<string[]>().notNull().default([]),
  logoUrl: text("logo_url"),
  tone: text("tone"),
  audience: text("audience"),
  forbiddenTerms: jsonb("forbidden_terms").$type<string[]>().notNull().default([]),
  styleNotes: text("style_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("idx_brand_kit_workspace").on(t.workspaceId)]);

export const activityLogTable = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id"),
  userId: varchar("user_id"),
  projectId: varchar("project_id"),
  assetId: varchar("asset_id"),
  type: varchar("type", { length: 100 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_activity_workspace").on(t.workspaceId),
  index("idx_activity_created").on(t.createdAt),
]);

export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = typeof organizationsTable.$inferInsert;
export type Workspace = typeof workspacesTable.$inferSelect;
export type InsertWorkspace = typeof workspacesTable.$inferInsert;
export type Membership = typeof membershipsTable.$inferSelect;
export type InsertMembership = typeof membershipsTable.$inferInsert;
export type BrandKit = typeof brandKitsTable.$inferSelect;
export type InsertBrandKit = typeof brandKitsTable.$inferInsert;
export type ActivityLog = typeof activityLogTable.$inferSelect;
