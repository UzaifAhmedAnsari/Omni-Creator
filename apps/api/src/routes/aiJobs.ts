import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, aiJobsTable, projectsTable, workspacesTable, membershipsTable, providerConfigsTable, projectPlansTable } from "@workspace/db";
import {
  ListAiJobsParams,
  ListAiJobsQueryParams,
  ListAiJobsResponse,
  CreateAiJobParams,
  CreateAiJobBody,
  GetAiJobParams,
  GetAiJobResponse,
  CancelAiJobParams,
  RetryAiJobParams,
  GenerateProjectPlanParams,
  GenerateProjectPlanBody,
  GenerateProjectPlanResponse,
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

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  if (!ws) return null;
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, userId))
  );
  return m ? { ws, member: m } : null;
}

async function getProjectAccess(projectId: string, userId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return null;
  const access = await getWorkspaceAccess(project.workspaceId, userId);
  return access ? { project, ...access } : null;
}

router.get("/workspaces/:workspaceId/ai-jobs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListAiJobsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = ListAiJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const conditions = [eq(aiJobsTable.workspaceId, params.data.workspaceId)];
  if (query.data.projectId) {
    conditions.push(eq(aiJobsTable.projectId, query.data.projectId));
  }

  const jobs = await db
    .select()
    .from(aiJobsTable)
    .where(and(...conditions))
    .orderBy(desc(aiJobsTable.createdAt));

  res.json(ListAiJobsResponse.parse(jobs));
});

router.post("/workspaces/:workspaceId/ai-jobs", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateAiJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateAiJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const providerKey = parsed.data.providerKey ?? "openai";

  const [providerConfig] = await db
    .select()
    .from(providerConfigsTable)
    .where(and(
      eq(providerConfigsTable.orgId, access.ws.orgId),
      eq(providerConfigsTable.providerKey, providerKey),
    ));

  if (!providerConfig?.configured) {
    const [job] = await db.insert(aiJobsTable).values({
      workspaceId: params.data.workspaceId,
      projectId: parsed.data.projectId ?? null,
      taskType: parsed.data.taskType,
      providerKey,
      prompt: parsed.data.prompt ?? null,
      parameters: (parsed.data.parameters ?? {}) as Record<string, unknown>,
      status: "setup_required",
      errorMessage: `Provider '${providerKey}' is not configured. Add your API key in Settings > AI Providers.`,
      setupRequiredInfo: { provider: providerKey } as Record<string, unknown>,
      createdById: req.user!.id,
    }).returning();
    res.status(202).json(GetAiJobResponse.parse(job));
    return;
  }

  const [job] = await db.insert(aiJobsTable).values({
    workspaceId: params.data.workspaceId,
    projectId: parsed.data.projectId ?? null,
    taskType: parsed.data.taskType,
    providerKey,
    prompt: parsed.data.prompt ?? null,
    parameters: (parsed.data.parameters ?? {}) as Record<string, unknown>,
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

  res.json(GenerateProjectPlanResponse.parse({
    projectId: params.data.projectId,
    hooks: [],
    script: null,
    scenes: [],
    creditEstimate: 0,
    safetyWarnings: ["AI provider not configured — add an API key in Settings > AI Providers to generate plans."],
    updatedAt: new Date().toISOString(),
  }));
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

  const [plan] = await db
    .select()
    .from(projectPlansTable)
    .where(eq(projectPlansTable.projectId, params.data.projectId));

  if (!plan) {
    res.status(404).json({ error: "No plan found for this project" });
    return;
  }

  res.json(GetProjectPlanResponse.parse({
    projectId: plan.projectId,
    hooks: plan.hooks ?? [],
    script: plan.script ?? null,
    scenes: plan.scenes ?? [],
    layoutPlan: null,
    creditEstimate: 0,
    updatedAt: plan.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));
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

  await db
    .insert(projectPlansTable)
    .values({
      projectId: params.data.projectId,
      hooks: parsed.data.hooks as unknown[],
      script: (parsed.data.script ?? null) as Record<string, unknown> | null,
      scenes: parsed.data.scenes as unknown[],
    })
    .onConflictDoUpdate({
      target: projectPlansTable.projectId,
      set: {
        hooks: parsed.data.hooks as unknown[],
        script: (parsed.data.script ?? null) as Record<string, unknown> | null,
        scenes: parsed.data.scenes as unknown[],
        updatedAt: new Date(),
      },
    });

  res.json(SaveProjectPlanResponse.parse({
    projectId: params.data.projectId,
    hooks: parsed.data.hooks,
    script: parsed.data.script ?? null,
    scenes: parsed.data.scenes,
    creditEstimate: parsed.data.creditEstimate,
    updatedAt: parsed.data.updatedAt,
  }));
});

export default router;
