import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, projectsTable, aiJobsTable, publishingJobsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  GetWorkspaceAnalyticsParams,
  GetWorkspaceAnalyticsQueryParams,
  GetWorkspaceAnalyticsResponse,
  GetProjectAnalyticsParams,
  GetProjectAnalyticsResponse,
  GetAnalyticsRecommendationsParams,
  GetAnalyticsRecommendationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/workspaces/:workspaceId/analytics", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetWorkspaceAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetWorkspaceAnalyticsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
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

  const [projectCount] = await db
    .select({ count: count() })
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, params.data.workspaceId));

  const [jobCount] = await db
    .select({ count: count() })
    .from(aiJobsTable)
    .where(and(
      eq(aiJobsTable.workspaceId, params.data.workspaceId),
      eq(aiJobsTable.status, "succeeded"),
    ));

  const [publishedCount] = await db
    .select({ count: count() })
    .from(publishingJobsTable)
    .where(and(
      eq(publishingJobsTable.workspaceId, params.data.workspaceId),
      eq(publishingJobsTable.status, "published"),
    ));

  const [totalPublished] = await db
    .select({ count: count() })
    .from(publishingJobsTable)
    .where(eq(publishingJobsTable.workspaceId, params.data.workspaceId));

  const successRate = totalPublished?.count
    ? Math.round(((publishedCount?.count ?? 0) / totalPublished.count) * 100) / 100
    : 0;

  const periodStart = query.data.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = query.data.endDate ?? new Date().toISOString();

  res.json(GetWorkspaceAnalyticsResponse.parse({
    workspaceId: params.data.workspaceId,
    period: { startDate: periodStart, endDate: periodEnd },
    projectsCreated: projectCount?.count ?? 0,
    assetsGenerated: jobCount?.count ?? 0,
    publishingSuccessRate: successRate,
    totalCreditsUsed: 0,
    topPlatforms: [],
    postPerformance: [],
  }));
});

router.get("/projects/:projectId/analytics", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetProjectAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, project.workspaceId));
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

  res.json(GetProjectAnalyticsResponse.parse({
    projectId: params.data.projectId,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    watchTime: null,
    publishedPosts: [],
  }));
});

router.get("/workspaces/:workspaceId/analytics/recommendations", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetAnalyticsRecommendationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  res.json(GetAnalyticsRecommendationsResponse.parse([]));
});

export default router;
