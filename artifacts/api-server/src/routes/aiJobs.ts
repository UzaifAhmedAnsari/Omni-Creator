import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, aiJobsTable, projectsTable, workspacesTable, membershipsTable, providerConfigsTable } from "@workspace/db";
import {
  ListAiJobsParams,
  ListAiJobsResponse,
  CreateAiJobParams,
  CreateAiJobBody,
  GetAiJobParams,
  GetAiJobResponse,
  CancelAiJobParams,
  RetryAiJobParams,
  GenerateProjectPlanParams,
  GenerateProjectPlanBody,
  GetProjectPlanParams,
  GetProjectPlanResponse,
  SaveProjectPlanParams,
  SaveProjectPlanBody,
  SaveProjectPlanResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function getProjectAccess(projectId: string, userId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return null;
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, project.workspaceId));
  if (!ws) return null;
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, userId))
  );
  return m ? { project, ws, member: m } : null;
}

router.get("/projects/:projectId/ai-jobs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListAiJobsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const jobs = await db
    .select()
    .from(aiJobsTable)
    .where(eq(aiJobsTable.projectId, params.data.projectId))
    .orderBy(desc(aiJobsTable.createdAt));

  res.json(ListAiJobsResponse.parse(jobs));
});

router.post("/projects/:projectId/ai-jobs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateAiJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateAiJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [providerConfig] = await db
    .select()
    .from(providerConfigsTable)
    .where(and(
      eq(providerConfigsTable.orgId, access.ws.orgId),
      eq(providerConfigsTable.providerKey, parsed.data.provider),
    ));

  if (!providerConfig?.configured) {
    const [job] = await db.insert(aiJobsTable).values({
      projectId: params.data.projectId,
      workspaceId: access.ws.id,
      taskType: parsed.data.type,
      providerKey: parsed.data.provider,
      prompt: parsed.data.prompt ?? null,
      parameters: (parsed.data.params ?? {}) as Record<string, unknown>,
      status: "setup_required",
      errorMessage: `Provider '${parsed.data.provider}' is not configured. Add your API key in Settings > AI Providers.`,
      setupRequiredInfo: { provider: parsed.data.provider } as Record<string, unknown>,
      createdById: req.user!.id,
    }).returning();
    res.status(202).json(GetAiJobResponse.parse(job));
    return;
  }

  const [job] = await db.insert(aiJobsTable).values({
    projectId: params.data.projectId,
    workspaceId: access.ws.id,
    taskType: parsed.data.type,
    providerKey: parsed.data.provider,
    prompt: parsed.data.prompt ?? null,
    parameters: (parsed.data.params ?? {}) as Record<string, unknown>,
    status: "queued",
    createdById: req.user!.id,
  }).returning();

  res.status(202).json(GetAiJobResponse.parse(job));
});

router.get("/ai-jobs/:jobId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetAiJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "AI job not found" });
    return;
  }

  res.json(GetAiJobResponse.parse(job));
});

router.post("/ai-jobs/:jobId/cancel", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CancelAiJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "AI job not found" });
    return;
  }

  if (!["queued", "running"].includes(job.status)) {
    res.status(400).json({ error: "Job cannot be cancelled in its current state" });
    return;
  }

  const [updated] = await db
    .update(aiJobsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(aiJobsTable.id, params.data.jobId))
    .returning();

  res.json(GetAiJobResponse.parse(updated));
});

router.post("/ai-jobs/:jobId/retry", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = RetryAiJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(aiJobsTable).where(eq(aiJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "AI job not found" });
    return;
  }

  if (!["failed", "cancelled", "setup_required"].includes(job.status)) {
    res.status(400).json({ error: "Only failed or cancelled jobs can be retried" });
    return;
  }

  const [updated] = await db
    .update(aiJobsTable)
    .set({ status: "queued", errorMessage: null, setupRequiredInfo: null, updatedAt: new Date() })
    .where(eq(aiJobsTable.id, params.data.jobId))
    .returning();

  res.json(GetAiJobResponse.parse(updated));
});

router.post("/projects/:projectId/ai-plan", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GenerateProjectPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = GenerateProjectPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    plan: {
      setupRequired: true,
      message: "AI plan generation requires an AI provider to be configured in your workspace settings.",
      prompt: parsed.data.prompt,
    },
  });
});

router.get("/projects/:projectId/ai-plan", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetProjectPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetProjectPlanResponse.parse({ plan: null }));
});

router.put("/projects/:projectId/ai-plan", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = SaveProjectPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveProjectPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(SaveProjectPlanResponse.parse({ plan: parsed.data.plan }));
});

export default router;
