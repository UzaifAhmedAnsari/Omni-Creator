import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const providerConfigsTable = pgTable("provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  providerKey: varchar("provider_key", { length: 100 }).notNull(),
  name: varchar("name", { length: 200 }),
  encryptedApiKey: text("encrypted_api_key"),
  configured: boolean("configured").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  taskTypes: jsonb("task_types").$type<string[]>().notNull().default([]),
  dailyLimit: integer("daily_limit"),
  allowedModels: jsonb("allowed_models").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_provider_org").on(t.orgId),
]);

export type ProviderConfig = typeof providerConfigsTable.$inferSelect;
export type InsertProviderConfig = typeof providerConfigsTable.$inferInsert;
