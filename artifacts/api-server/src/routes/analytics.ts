import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import { db, postMetricsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  GetWorkspaceAnalyticsParams,
  GetWorkspaceAnalyticsQueryParams,
  GetWorkspaceAnalyticsResponse,
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

  const since = query.data.since ? new Date(query.data.since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const metrics = await db
    .select()
    .from(postMetricsTable)
    .where(and(
      eq(postMetricsTable.workspaceId, params.data.workspaceId),
      gte(postMetricsTable.fetchedAt, since),
    ))
    .orderBy(desc(postMetricsTable.fetchedAt))
    .limit(query.data.limit ?? 100);

  const totalViews = metrics.reduce((sum, m) => sum + (m.views ?? 0), 0);
  const totalLikes = metrics.reduce((sum, m) => sum + (m.likes ?? 0), 0);
  const totalShares = metrics.reduce((sum, m) => sum + (m.shares ?? 0), 0);
  const totalComments = metrics.reduce((sum, m) => sum + (m.comments ?? 0), 0);

  res.json(GetWorkspaceAnalyticsResponse.parse({
    totalViews,
    totalLikes,
    totalShares,
    totalComments,
    metrics,
    recommendations: [],
    setupRequired: true,
    setupMessage: "Connect your social accounts and configure analytics webhooks in Workspace Settings to see real-time metrics.",
  }));
});

export default router;
