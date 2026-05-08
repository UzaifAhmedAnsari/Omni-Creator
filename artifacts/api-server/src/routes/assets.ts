import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, assetsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListAssetsParams,
  ListAssetsResponse,
  GetAssetParams,
  GetAssetResponse,
  UpdateAssetParams,
  UpdateAssetBody,
  UpdateAssetResponse,
  DeleteAssetParams,
  DeleteAssetResponse,
  GetUploadUrlBody,
  GetUploadUrlResponse,
} from "@workspace/api-zod";
import crypto from "crypto";

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

router.get("/workspaces/:workspaceId/assets", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListAssetsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const assets = await db.select().from(assetsTable).where(
    and(
      eq(assetsTable.workspaceId, params.data.workspaceId),
      eq(assetsTable.isDeleted, false),
    )
  );

  res.json(ListAssetsResponse.parse(assets));
});

router.get("/assets/:assetId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, params.data.assetId));
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const access = await getWorkspaceAccess(asset.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetAssetResponse.parse(asset));
});

router.patch("/assets/:assetId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, params.data.assetId));
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const access = await getWorkspaceAccess(asset.workspaceId, req.user!.id);
  if (!access || access.member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(assetsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(assetsTable.id, params.data.assetId))
    .returning();

  res.json(UpdateAssetResponse.parse(updated));
});

router.delete("/assets/:assetId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = DeleteAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, params.data.assetId));
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const access = await getWorkspaceAccess(asset.workspaceId, req.user!.id);
  if (!access || !["owner", "admin", "editor"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(assetsTable).set({ isDeleted: true, updatedAt: new Date() }).where(eq(assetsTable.id, params.data.assetId));

  res.json(DeleteAssetResponse.parse({ success: true }));
});

router.post("/assets/upload-url", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = GetUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const access = await getWorkspaceAccess(parsed.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const assetType = parsed.data.mimeType.startsWith("video/") ? "video" :
    parsed.data.mimeType.startsWith("image/") ? "image" :
    parsed.data.mimeType.startsWith("audio/") ? "audio" : "document";

  const key = `${parsed.data.workspaceId}/${crypto.randomUUID()}/${parsed.data.fileName}`;

  const [asset] = await db.insert(assetsTable).values({
    workspaceId: parsed.data.workspaceId,
    name: parsed.data.fileName,
    type: assetType as "image" | "video" | "audio" | "document" | "other",
    mimeType: parsed.data.mimeType,
    url: `/uploads/${key}`,
    source: "uploaded",
    createdById: req.user!.id,
  }).returning();

  res.json(GetUploadUrlResponse.parse({
    uploadUrl: `/api/assets/upload/${key}`,
    assetId: asset.id,
    key,
  }));
});

export default router;
