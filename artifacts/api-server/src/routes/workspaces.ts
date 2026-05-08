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

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function checkOrgAccess(orgId: string, userId: string, roles?: string[]) {
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, orgId), eq(membershipsTable.userId, userId))
  );
  if (!m) return null;
  if (roles && !roles.includes(m.role)) return null;
  return m;
}

router.get("/organizations/:orgId/workspaces", async (req: Request, res: Response): Promise<void> => {
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

  const workspaces = await db.select().from(workspacesTable).where(
    eq(workspacesTable.orgId, params.data.orgId)
  );

  res.json(ListWorkspacesResponse.parse(workspaces));
});

router.post("/organizations/:orgId/workspaces", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await checkOrgAccess(params.data.orgId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [ws] = await db.insert(workspacesTable).values({
    orgId: params.data.orgId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  }).returning();

  res.status(201).json(GetWorkspaceResponse.parse(ws));
});

router.get("/workspaces/:workspaceId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(
    eq(workspacesTable.id, params.data.workspaceId)
  );
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const access = await checkOrgAccess(ws.orgId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetWorkspaceResponse.parse(ws));
});

router.patch("/workspaces/:workspaceId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(
    eq(workspacesTable.id, params.data.workspaceId)
  );
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const access = await checkOrgAccess(ws.orgId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(workspacesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workspacesTable.id, params.data.workspaceId))
    .returning();

  res.json(UpdateWorkspaceResponse.parse(updated));
});

export default router;
