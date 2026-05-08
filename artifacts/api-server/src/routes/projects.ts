import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, projectsTable, workspacesTable, membershipsTable, timelinesTable, canvasesTable } from "@workspace/db";
import {
  ListProjectsParams,
  ListProjectsQueryParams,
  ListProjectsResponse,
  CreateProjectParams,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  DeleteProjectResponse,
  DuplicateProjectParams,
  ArchiveProjectParams,
  RestoreProjectParams,
  GetTimelineParams,
  GetTimelineResponse,
  SaveTimelineParams,
  SaveTimelineBody,
  SaveTimelineResponse,
  GetCanvasParams,
  GetCanvasResponse,
  SaveCanvasParams,
  SaveCanvasBody,
  SaveCanvasResponse,
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

router.get("/workspaces/:workspaceId/projects", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListProjectsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const conditions = [eq(projectsTable.workspaceId, params.data.workspaceId)];

  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(...conditions))
    .orderBy(desc(projectsTable.updatedAt));

  res.json(ListProjectsResponse.parse(projects));
});

router.post("/workspaces/:workspaceId/projects", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    workspaceId: params.data.workspaceId,
    name: parsed.data.name,
    type: parsed.data.type as "video" | "image" | "carousel" | "ad" | "thumbnail" | "product_mockup" | "campaign" | "template" | "asset_only",
    createdById: req.user!.id,
    status: "draft",
  }).returning();

  res.status(201).json(GetProjectResponse.parse(project));
});

router.get("/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  res.json(GetProjectResponse.parse(access.project));
});

router.patch("/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();

  res.json(UpdateProjectResponse.parse(updated));
});

router.delete("/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || !["owner", "admin", "editor"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.projectId));

  res.json(DeleteProjectResponse.parse({ success: true }));
});

router.post("/projects/:projectId/duplicate", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = DuplicateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = access.project;

  const [copy] = await db.insert(projectsTable).values({
    ...rest,
    name: `${access.project.name} (Copy)`,
    status: "draft",
    createdById: req.user!.id,
  }).returning();

  res.status(201).json(GetProjectResponse.parse(copy));
});

router.post("/projects/:projectId/archive", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ArchiveProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ status: "archived", isArchived: true, updatedAt: new Date() })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();

  res.json(GetProjectResponse.parse(updated));
});

router.post("/projects/:projectId/restore", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = RestoreProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ status: "draft", isArchived: false, updatedAt: new Date() })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();

  res.json(GetProjectResponse.parse(updated));
});

router.get("/projects/:projectId/timeline", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const [timeline] = await db.select().from(timelinesTable).where(
    eq(timelinesTable.projectId, params.data.projectId)
  );

  res.json(GetTimelineResponse.parse({
    data: timeline ? { tracks: timeline.tracks, captions: timeline.captions, durationMs: timeline.durationMs, audioMix: timeline.audioMix, exportSettings: timeline.exportSettings } : null
  }));
});

router.put("/projects/:projectId/timeline", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = SaveTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveTimelineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const data = parsed.data.data as Record<string, unknown>;

  await db
    .insert(timelinesTable)
    .values({
      projectId: params.data.projectId,
      tracks: (data?.tracks ?? []) as unknown[],
      captions: (data?.captions ?? []) as unknown[],
      durationMs: (data?.durationMs as number) ?? 0,
      audioMix: (data?.audioMix ?? {}) as Record<string, unknown>,
      exportSettings: (data?.exportSettings ?? {}) as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: timelinesTable.projectId,
      set: {
        tracks: (data?.tracks ?? []) as unknown[],
        captions: (data?.captions ?? []) as unknown[],
        durationMs: (data?.durationMs as number) ?? 0,
        audioMix: (data?.audioMix ?? {}) as Record<string, unknown>,
        exportSettings: (data?.exportSettings ?? {}) as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  res.json(SaveTimelineResponse.parse({ success: true }));
});

router.get("/projects/:projectId/canvas", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetCanvasParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const [canvas] = await db.select().from(canvasesTable).where(
    eq(canvasesTable.projectId, params.data.projectId)
  );

  res.json(GetCanvasResponse.parse({
    data: canvas ? { pages: canvas.pages, sharedAssets: canvas.sharedAssets } : null
  }));
});

router.put("/projects/:projectId/canvas", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = SaveCanvasParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveCanvasBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const access = await getProjectAccess(params.data.projectId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden or not found" });
    return;
  }

  const data = parsed.data.data as Record<string, unknown>;

  await db
    .insert(canvasesTable)
    .values({
      projectId: params.data.projectId,
      pages: (data?.pages ?? []) as unknown[],
      sharedAssets: (data?.sharedAssets ?? []) as string[],
    })
    .onConflictDoUpdate({
      target: canvasesTable.projectId,
      set: {
        pages: (data?.pages ?? []) as unknown[],
        sharedAssets: (data?.sharedAssets ?? []) as string[],
        updatedAt: new Date(),
      },
    });

  res.json(SaveCanvasResponse.parse({ success: true }));
});

export default router;
