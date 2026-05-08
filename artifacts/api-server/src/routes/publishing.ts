import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, publishingJobsTable, projectsTable, workspacesTable, membershipsTable, socialAccountsTable } from "@workspace/db";
import {
  ListPublishingJobsParams,
  ListPublishingJobsResponse,
  CreatePublishingJobParams,
  CreatePublishingJobBody,
  GetPublishingJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  if (!ws) return null;
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, userId))
  );
  return m ? { ws, member: m } : null;
}

router.get("/workspaces/:workspaceId/publishing", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListPublishingJobsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const jobs = await db
    .select()
    .from(publishingJobsTable)
    .where(eq(publishingJobsTable.workspaceId, params.data.workspaceId))
    .orderBy(desc(publishingJobsTable.createdAt));

  res.json(ListPublishingJobsResponse.parse(jobs));
});

router.post("/workspaces/:workspaceId/publishing", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreatePublishingJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access || !["owner", "admin", "editor", "publisher"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreatePublishingJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parsed.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [socialAccount] = parsed.data.socialAccountId
    ? await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.id, parsed.data.socialAccountId))
    : [null];

  if (!socialAccount || socialAccount.status !== "active") {
    const [job] = await db.insert(publishingJobsTable).values({
      workspaceId: params.data.workspaceId,
      projectId: parsed.data.projectId,
      socialAccountId: parsed.data.socialAccountId ?? null,
      platform: (socialAccount?.platform ?? "youtube") as "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "twitter" | "pinterest",
      status: "failed",
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      metadata: { caption: parsed.data.caption, hashtags: parsed.data.hashtags } as Record<string, unknown>,
      errorMessage: "Social account is not connected or has expired. Please reconnect in Workspace Settings.",
    }).returning();
    res.status(202).json(GetPublishingJobResponse.parse(job));
    return;
  }

  const status = parsed.data.scheduledAt ? "scheduled" : "preflight_pending";

  const [job] = await db.insert(publishingJobsTable).values({
    workspaceId: params.data.workspaceId,
    projectId: parsed.data.projectId,
    socialAccountId: parsed.data.socialAccountId ?? null,
    platform: socialAccount.platform,
    status,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    metadata: { caption: parsed.data.caption, hashtags: parsed.data.hashtags } as Record<string, unknown>,
  }).returning();

  res.status(202).json(GetPublishingJobResponse.parse(job));
});

export default router;
