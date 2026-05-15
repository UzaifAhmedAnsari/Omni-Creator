import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandKitsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListBrandKitsParams,
  ListBrandKitsResponse,
  CreateBrandKitParams,
  CreateBrandKitBody,
  GetBrandKitParams,
  GetBrandKitResponse,
  UpdateBrandKitParams,
  UpdateBrandKitBody,
  UpdateBrandKitResponse,
  DeleteBrandKitParams,
  DeleteBrandKitResponse,
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

router.get("/workspaces/:workspaceId/brand-kits", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListBrandKitsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const kits = await db.select().from(brandKitsTable).where(
    eq(brandKitsTable.workspaceId, params.data.workspaceId)
  );

  res.json(ListBrandKitsResponse.parse(kits));
});

router.post("/workspaces/:workspaceId/brand-kits", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateBrandKitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateBrandKitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [kit] = await db.insert(brandKitsTable).values({
    workspaceId: params.data.workspaceId,
    name: parsed.data.name,
    colors: (parsed.data.colors ?? []) as string[],
    fonts: (parsed.data.fonts ?? []) as string[],
  }).returning();

  res.status(201).json(GetBrandKitResponse.parse(kit));
});

router.get("/brand-kits/:brandKitId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetBrandKitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [kit] = await db.select().from(brandKitsTable).where(eq(brandKitsTable.id, params.data.brandKitId));
  if (!kit) {
    res.status(404).json({ error: "Brand kit not found" });
    return;
  }

  const access = await getWorkspaceAccess(kit.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetBrandKitResponse.parse(kit));
});

router.patch("/brand-kits/:brandKitId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateBrandKitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [kit] = await db.select().from(brandKitsTable).where(eq(brandKitsTable.id, params.data.brandKitId));
  if (!kit) {
    res.status(404).json({ error: "Brand kit not found" });
    return;
  }

  const access = await getWorkspaceAccess(kit.workspaceId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateBrandKitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.colors != null) updateData.colors = parsed.data.colors;
  if (parsed.data.fonts != null) updateData.fonts = parsed.data.fonts;

  const [updated] = await db
    .update(brandKitsTable)
    .set(updateData)
    .where(eq(brandKitsTable.id, params.data.brandKitId))
    .returning();

  res.json(UpdateBrandKitResponse.parse(updated));
});

router.delete("/brand-kits/:brandKitId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = DeleteBrandKitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [kit] = await db.select().from(brandKitsTable).where(eq(brandKitsTable.id, params.data.brandKitId));
  if (!kit) {
    res.status(404).json({ error: "Brand kit not found" });
    return;
  }

  const access = await getWorkspaceAccess(kit.workspaceId, req.user!.id);
  if (!access || !["owner", "admin"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(brandKitsTable).where(eq(brandKitsTable.id, params.data.brandKitId));

  res.json(DeleteBrandKitResponse.parse({ success: true }));
});

export default router;
