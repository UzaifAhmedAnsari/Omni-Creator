import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, real, timestamp, varchar } from "drizzle-orm/pg-core";
import { workspacesTable } from "./organizations";

export const postMetricsTable = pgTable("post_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  projectId: varchar("project_id").notNull(),
  publishingJobId: varchar("publishing_job_id"),
  platform: varchar("platform", { length: 50 }).notNull(),
  platformPostId: varchar("platform_post_id"),
  views: real("views"),
  likes: real("likes"),
  comments: real("comments"),
  shares: real("shares"),
  saves: real("saves"),
  watchTime: real("watch_time"),
  impressions: real("impressions"),
  reach: real("reach"),
  clickThrough: real("click_through"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_post_metrics_workspace").on(t.workspaceId),
  index("idx_post_metrics_project").on(t.projectId),
]);

export type PostMetrics = typeof postMetricsTable.$inferSelect;
