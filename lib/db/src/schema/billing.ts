import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const usageLedgerTable = pgTable("usage_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id"),
  userId: varchar("user_id"),
  jobId: varchar("job_id"),
  jobType: varchar("job_type", { length: 100 }).notNull(),
  credits: real("credits").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_usage_org").on(t.orgId),
  index("idx_usage_created").on(t.createdAt),
]);

export const invoicesTable = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  stripeInvoiceId: varchar("stripe_invoice_id"),
  amount: real("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("usd"),
  status: varchar("status", { length: 50 }).notNull(),
  pdfUrl: text("pdf_url"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idx_invoice_org").on(t.orgId)]);

export type UsageLedgerEntry = typeof usageLedgerTable.$inferSelect;
export type InsertUsageLedgerEntry = typeof usageLedgerTable.$inferInsert;
