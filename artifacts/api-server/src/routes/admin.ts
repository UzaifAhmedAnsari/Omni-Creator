import { Router, type IRouter, type Request, type Response } from "express";
import { desc, count, eq, sum } from "drizzle-orm";
import { db, usersTable, organizationsTable, projectsTable, aiJobsTable } from "@workspace/db";
import {
  AdminListUsersQueryParams,
  AdminListUsersResponse,
  AdminListAiJobsQueryParams,
  AdminListAiJobsResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SUPPORT_ADMIN_IDS = (process.env.SUPPORT_ADMIN_IDS ?? "").split(",").filter(Boolean);

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (!SUPPORT_ADMIN_IDS.includes(req.user!.id)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/admin/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const query = AdminListUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(query.data.limit ?? 50)
    .offset(query.data.offset ?? 0);

  const [total] = await db.select({ count: count() }).from(usersTable);

  res.json(AdminListUsersResponse.parse({
    users,
    total: total?.count ?? 0,
  }));
});

router.get("/admin/ai-jobs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const query = AdminListAiJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) {
    conditions.push(eq(aiJobsTable.status, query.data.status as "draft" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "blocked" | "setup_required"));
  }

  const jobs = await db
    .select()
    .from(aiJobsTable)
    .where(conditions.length ? conditions[0] : undefined)
    .orderBy(desc(aiJobsTable.createdAt))
    .limit(query.data.limit ?? 50);

  res.json(AdminListAiJobsResponse.parse(jobs));
});

router.get("/admin/stats", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [orgCount] = await db.select({ count: count() }).from(organizationsTable);
  const [projectCount] = await db.select({ count: count() }).from(projectsTable);
  const [jobCount] = await db.select({ count: count() }).from(aiJobsTable);
  const [activeJobs] = await db.select({ count: count() }).from(aiJobsTable).where(eq(aiJobsTable.status, "running"));
  const [creditsResult] = await db.select({ total: sum(aiJobsTable.creditsEstimated) }).from(aiJobsTable);

  res.json(GetAdminStatsResponse.parse({
    totalUsers: userCount?.count ?? 0,
    totalOrgs: orgCount?.count ?? 0,
    totalProjects: projectCount?.count ?? 0,
    totalAiJobs: jobCount?.count ?? 0,
    activeJobs: activeJobs?.count ?? 0,
    totalCreditsUsed: Number(creditsResult?.total ?? 0),
  }));
});

export default router;
