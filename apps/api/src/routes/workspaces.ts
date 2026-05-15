import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListWorkspacesParams,
  ListWorkspacesResponse,
  CreateWorkspaceParams,
  CreateWorkspaceBody,
  GetWorkspaceParams,
  GetWorkspaceResponse,
  UpdateWorkspaceParams,
  UpdateWorkspaceBody,
  UpdateWorkspaceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type WorkspaceRow = typeof workspacesTable.$inferSelect;

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

function serializeWorkspace(workspace: WorkspaceRow) {
  return {
    id: workspace.id,
    orgId: workspace.orgId,
    name: workspace.name,
    description: workspace.description ?? null,
    defaultBrandKitId: workspace.defaultBrandKitId ?? null,
    createdAt: dateToString(workspace.createdAt),
    updatedAt: dateToString(workspace.updatedAt),
  };
}

async function checkOrgAccess(
  orgId: string,
  userId: string,
  roles?: string[],
) {
  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.orgId, orgId),
        eq(membershipsTable.userId, userId),
      ),
    );

  if (!membership) {
    return null;
  }

  if (roles && !roles.includes(membership.role)) {
    return null;
  }

  return membership;
}

router.get(
  "/organizations/:orgId/workspaces",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = ListWorkspacesParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await checkOrgAccess(params.data.orgId, req.user!.id);

    if (!access) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const workspaces = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.orgId, params.data.orgId));

    res.json(ListWorkspacesResponse.parse(workspaces.map(serializeWorkspace)));
  },
);

router.post(
  "/organizations/:orgId/workspaces",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = CreateWorkspaceParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const access = await checkOrgAccess(params.data.orgId, req.user!.id, [
      "owner",
      "admin",
    ]);

    if (!access) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = CreateWorkspaceBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [workspace] = await db
      .insert(workspacesTable)
      .values({
        id: crypto.randomUUID(),
        orgId: params.data.orgId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .returning();

    res.status(201).json(GetWorkspaceResponse.parse(serializeWorkspace(workspace)));
  },
);

router.get(
  "/workspaces/:workspaceId",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = GetWorkspaceParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, params.data.workspaceId));

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const access = await checkOrgAccess(workspace.orgId, req.user!.id);

    if (!access) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(GetWorkspaceResponse.parse(serializeWorkspace(workspace)));
  },
);

router.patch(
  "/workspaces/:workspaceId",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = UpdateWorkspaceParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, params.data.workspaceId));

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const access = await checkOrgAccess(workspace.orgId, req.user!.id, [
      "owner",
      "admin",
    ]);

    if (!access) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = UpdateWorkspaceBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updateData: Partial<typeof workspacesTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description;
    }

    if (parsed.data.defaultBrandKitId !== undefined) {
      updateData.defaultBrandKitId = parsed.data.defaultBrandKitId;
    }

    const [updated] = await db
      .update(workspacesTable)
      .set(updateData)
      .where(eq(workspacesTable.id, params.data.workspaceId))
      .returning();

    res.json(UpdateWorkspaceResponse.parse(serializeWorkspace(updated)));
  },
);

export default router;