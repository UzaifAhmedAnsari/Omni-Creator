import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  workspacesTable,
  membershipsTable,
  timelinesTable,
  canvasesTable,
} from "@workspace/db";
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

const PROJECT_TYPES = [
  "video",
  "image",
  "carousel",
  "ad",
  "thumbnail",
  "product_mockup",
  "campaign",
  "template",
  "asset_only",
] as const;

const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "review",
  "approved",
  "published",
  "archived",
] as const;

type ProjectType = (typeof PROJECT_TYPES)[number];
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

type ProjectRow = typeof projectsTable.$inferSelect;
type ProjectInsert = typeof projectsTable.$inferInsert;
type TimelineRow = typeof timelinesTable.$inferSelect;
type CanvasRow = typeof canvasesTable.$inferSelect;

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}

function dateToString(value: Date | string | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date().toISOString();
}

function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType);
}

function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

function serializeProject(project: ProjectRow) {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    type: project.type,
    status: project.status,
    platform: project.platform ?? null,
    aspectRatio: project.aspectRatio ?? null,
    duration: project.duration ?? null,
    language: project.language ?? null,
    brandKitId: project.brandKitId ?? null,
    thumbnailUrl: project.thumbnailUrl ?? null,
    tags: project.tags ?? [],
    isArchived: project.isArchived,
    createdById: project.createdById,
    createdAt: dateToString(project.createdAt),
    updatedAt: dateToString(project.updatedAt),
  };
}

function serializeTimeline(timeline: TimelineRow) {
  return {
    id: timeline.id,
    projectId: timeline.projectId,
    version: timeline.version,
    durationMs: timeline.durationMs,
    tracks: timeline.tracks ?? [],
    captions: timeline.captions ?? [],
    audioMix: timeline.audioMix ?? undefined,
    exportSettings: timeline.exportSettings ?? undefined,
    updatedAt: dateToString(timeline.updatedAt),
  };
}

function serializeCanvas(canvas: CanvasRow) {
  return {
    id: canvas.id,
    projectId: canvas.projectId,
    version: canvas.version,
    pages: canvas.pages ?? [],
    sharedAssets: canvas.sharedAssets ?? [],
    brandKitId: canvas.brandKitId ?? null,
    updatedAt: dateToString(canvas.updatedAt),
  };
}

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) {
    return null;
  }

  const [member] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.orgId, workspace.orgId),
        eq(membershipsTable.userId, userId),
      ),
    );

  return member ? { workspace, member } : null;
}

async function getProjectAccess(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    return null;
  }

  const access = await getWorkspaceAccess(project.workspaceId, userId);

  return access ? { project, ...access } : null;
}

function canWrite(role: string): boolean {
  return ["owner", "admin", "editor"].includes(role);
}

router.get(
  "/workspaces/:workspaceId/projects",
  async (req: Request, res: Response): Promise<void> => {
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

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.workspaceId, params.data.workspaceId))
      .orderBy(desc(projectsTable.updatedAt));

    let filteredProjects = projects;

    if (query.data.type) {
      filteredProjects = filteredProjects.filter(
        (project) => project.type === query.data.type,
      );
    }

    if (query.data.status) {
      filteredProjects = filteredProjects.filter(
        (project) => project.status === query.data.status,
      );
    }

    if (query.data.search) {
      const search = query.data.search.toLowerCase();

      filteredProjects = filteredProjects.filter((project) =>
        project.name.toLowerCase().includes(search),
      );
    }

    if (query.data.archived !== undefined) {
      filteredProjects = filteredProjects.filter(
        (project) => project.isArchived === query.data.archived,
      );
    }

    res.json(
      ListProjectsResponse.parse(filteredProjects.map(serializeProject)),
    );
  },
);

router.post(
  "/workspaces/:workspaceId/projects",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = CreateProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = CreateProjectBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!isProjectType(parsed.data.type)) {
      res.status(400).json({ error: "Invalid project type." });
      return;
    }

    const projectValues: ProjectInsert = {
      id: crypto.randomUUID(),
      workspaceId: params.data.workspaceId,
      name: parsed.data.name,
      type: parsed.data.type,
      status: "draft",
      platform: parsed.data.platform ?? null,
      aspectRatio: parsed.data.aspectRatio ?? null,
      duration: parsed.data.duration ?? null,
      language: parsed.data.language ?? "en",
      brandKitId: parsed.data.brandKitId ?? null,
      tags: parsed.data.tags ?? [],
      createdById: req.user!.id,
    };

    const [project] = await db
      .insert(projectsTable)
      .values(projectValues)
      .returning();

    res.status(201).json(GetProjectResponse.parse(serializeProject(project)));
  },
);

router.get(
  "/projects/:projectId",
  async (req: Request, res: Response): Promise<void> => {
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

    res.json(GetProjectResponse.parse(serializeProject(access.project)));
  },
);

router.patch(
  "/projects/:projectId",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = UpdateProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getProjectAccess(params.data.projectId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const parsed = UpdateProjectBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateData: Partial<ProjectInsert> = {
      updatedAt: new Date(),
    };

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.status !== undefined) {
      if (!isProjectStatus(parsed.data.status)) {
        res.status(400).json({ error: "Invalid project status." });
        return;
      }

      updateData.status = parsed.data.status;
    }

    if (parsed.data.platform !== undefined) {
      updateData.platform = parsed.data.platform;
    }

    if (parsed.data.aspectRatio !== undefined) {
      updateData.aspectRatio = parsed.data.aspectRatio;
    }

    if (parsed.data.duration !== undefined) {
      updateData.duration = parsed.data.duration;
    }

    if (parsed.data.language !== undefined) {
      updateData.language = parsed.data.language;
    }

    if (parsed.data.brandKitId !== undefined) {
      updateData.brandKitId = parsed.data.brandKitId;
    }

    if (parsed.data.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = parsed.data.thumbnailUrl;
    }

    if (parsed.data.tags !== undefined) {
      updateData.tags = parsed.data.tags;
    }

    const [updated] = await db
      .update(projectsTable)
      .set(updateData)
      .where(eq(projectsTable.id, params.data.projectId))
      .returning();

    res.json(UpdateProjectResponse.parse(serializeProject(updated)));
  },
);

router.delete(
  "/projects/:projectId",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = DeleteProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getProjectAccess(params.data.projectId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    await db.delete(projectsTable).where(eq(projectsTable.id, params.data.projectId));

    res.json(DeleteProjectResponse.parse({ success: true }));
  },
);

router.post(
  "/projects/:projectId/duplicate",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = DuplicateProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getProjectAccess(params.data.projectId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...copyableProject
    } = access.project;

    const [copy] = await db
      .insert(projectsTable)
      .values({
        ...copyableProject,
        id: crypto.randomUUID(),
        name: `${access.project.name} (Copy)`,
        status: "draft",
        isArchived: false,
        createdById: req.user!.id,
      })
      .returning();

    res.status(201).json(GetProjectResponse.parse(serializeProject(copy)));
  },
);

router.post(
  "/projects/:projectId/archive",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = ArchiveProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getProjectAccess(params.data.projectId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const [updated] = await db
      .update(projectsTable)
      .set({
        status: "archived",
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, params.data.projectId))
      .returning();

    res.json(GetProjectResponse.parse(serializeProject(updated)));
  },
);

router.post(
  "/projects/:projectId/restore",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = RestoreProjectParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await getProjectAccess(params.data.projectId, req.user!.id);

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const [updated] = await db
      .update(projectsTable)
      .set({
        status: "draft",
        isArchived: false,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, params.data.projectId))
      .returning();

    res.json(GetProjectResponse.parse(serializeProject(updated)));
  },
);

router.get(
  "/projects/:projectId/timeline",
  async (req: Request, res: Response): Promise<void> => {
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

    const [timeline] = await db
      .select()
      .from(timelinesTable)
      .where(eq(timelinesTable.projectId, params.data.projectId));

    if (!timeline) {
      res.status(404).json({ error: "No timeline found for this project" });
      return;
    }

    res.json(GetTimelineResponse.parse(serializeTimeline(timeline)));
  },
);

router.put(
  "/projects/:projectId/timeline",
  async (req: Request, res: Response): Promise<void> => {
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

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const [saved] = await db
      .insert(timelinesTable)
      .values({
        id: crypto.randomUUID(),
        projectId: params.data.projectId,
        durationMs: parsed.data.durationMs,
        tracks: parsed.data.tracks as unknown[],
        captions: (parsed.data.captions ?? []) as unknown[],
        audioMix: (parsed.data.audioMix ?? {}) as Record<string, unknown>,
        exportSettings: (parsed.data.exportSettings ?? {}) as Record<
          string,
          unknown
        >,
      })
      .onConflictDoUpdate({
        target: timelinesTable.projectId,
        set: {
          durationMs: parsed.data.durationMs,
          tracks: parsed.data.tracks as unknown[],
          captions: (parsed.data.captions ?? []) as unknown[],
          audioMix: (parsed.data.audioMix ?? {}) as Record<string, unknown>,
          exportSettings: (parsed.data.exportSettings ?? {}) as Record<
            string,
            unknown
          >,
          version: sql`${timelinesTable.version} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(SaveTimelineResponse.parse(serializeTimeline(saved)));
  },
);

router.get(
  "/projects/:projectId/canvas",
  async (req: Request, res: Response): Promise<void> => {
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

    const [canvas] = await db
      .select()
      .from(canvasesTable)
      .where(eq(canvasesTable.projectId, params.data.projectId));

    if (!canvas) {
      res.status(404).json({ error: "No canvas found for this project" });
      return;
    }

    res.json(GetCanvasResponse.parse(serializeCanvas(canvas)));
  },
);

router.put(
  "/projects/:projectId/canvas",
  async (req: Request, res: Response): Promise<void> => {
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

    if (!access || !canWrite(access.member.role)) {
      res.status(403).json({ error: "Forbidden or not found" });
      return;
    }

    const [saved] = await db
      .insert(canvasesTable)
      .values({
        id: crypto.randomUUID(),
        projectId: params.data.projectId,
        pages: parsed.data.pages as unknown[],
        sharedAssets: (parsed.data.sharedAssets ?? []) as string[],
        brandKitId: parsed.data.brandKitId ?? null,
      })
      .onConflictDoUpdate({
        target: canvasesTable.projectId,
        set: {
          pages: parsed.data.pages as unknown[],
          sharedAssets: (parsed.data.sharedAssets ?? []) as string[],
          brandKitId: parsed.data.brandKitId ?? null,
          version: sql`${canvasesTable.version} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(SaveCanvasResponse.parse(serializeCanvas(saved)));
  },
);

export default router;