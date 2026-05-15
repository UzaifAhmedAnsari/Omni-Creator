import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, projectsTable, aiJobsTable, activityLogTable, publishingJobsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  GetDashboardParams,
  GetDashboardResponse,
  GetRecentActivityParams,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/workspaces/:workspaceId/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetDashboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, params.data.workspaceId));
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!m) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const allProjects = await db
    .select({ status: projectsTable.status })
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, params.data.workspaceId));

  const projectCounts: Record<string, number> = {};
  for (const p of allProjects) {
    projectCounts[p.status] = (projectCounts[p.status] ?? 0) + 1;
  }

  const [activeJobCount] = await db
    .select({ count: count() })
    .from(aiJobsTable)
    .where(and(
      eq(aiJobsTable.workspaceId, params.data.workspaceId),
      eq(aiJobsTable.status, "running"),
    ));

  const [scheduledCount] = await db
    .select({ count: count() })
    .from(publishingJobsTable)
    .where(and(
      eq(publishingJobsTable.workspaceId, params.data.workspaceId),
      eq(publishingJobsTable.status, "scheduled"),
    ));

  const recentProjects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, params.data.workspaceId))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(5);

  res.json(GetDashboardResponse.parse({
    workspaceId: params.data.workspaceId,
    projectCounts,
    recentProjects,
    creditsUsed: 0,
    creditsBalance: 0,
    scheduledPosts: scheduledCount?.count ?? 0,
    providerStatus: {},
    activeJobs: activeJobCount?.count ?? 0,
  }));
});

router.get("/workspaces/:workspaceId/recent-activity", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetRecentActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetRecentActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, params.data.workspaceId));
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [mem] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!mem) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const events = await db
    .select()
    .from(activityLogTable)
    .where(eq(activityLogTable.workspaceId, params.data.workspaceId))
    .orderBy(desc(activityLogTable.createdAt))
    .limit(query.data.limit ?? 20);

  res.json(GetRecentActivityResponse.parse(events));
});

export default router;
