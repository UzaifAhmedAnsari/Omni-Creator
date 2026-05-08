import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialAccountsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListSocialAccountsParams,
  ListSocialAccountsResponse,
  DisconnectSocialAccountParams,
  DisconnectSocialAccountResponse,
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

router.get("/workspaces/:workspaceId/social-accounts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListSocialAccountsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceAccess(params.data.workspaceId, req.user!.id);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const accounts = await db
    .select()
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.workspaceId, params.data.workspaceId));

  res.json(ListSocialAccountsResponse.parse(accounts));
});

router.post("/workspaces/:workspaceId/social-accounts", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const workspaceId = req.params.workspaceId as string;
  const body = req.body as Record<string, string | undefined>;

  if (!body.platform || !body.platformUserId || !body.platformUsername) {
    res.status(400).json({ error: "platform, platformUserId, and platformUsername are required" });
    return;
  }

  const access = await getWorkspaceAccess(workspaceId, req.user!.id);
  if (!access || !["owner", "admin"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [account] = await db.insert(socialAccountsTable).values({
    workspaceId,
    platform: body.platform as "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "twitter" | "pinterest",
    accountId: body.platformUserId,
    accountName: body.platformUsername,
    accessToken: body.accessToken ?? null,
    refreshToken: body.refreshToken ?? null,
    tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
    status: "active",
  }).returning();

  res.status(201).json(account);
});

router.delete("/social-accounts/:accountId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = DisconnectSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.id, params.data.accountId));
  if (!account) {
    res.status(404).json({ error: "Social account not found" });
    return;
  }

  const access = await getWorkspaceAccess(account.workspaceId, req.user!.id);
  if (!access || !["owner", "admin"].includes(access.member.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(socialAccountsTable).where(eq(socialAccountsTable.id, params.data.accountId));

  res.json(DisconnectSocialAccountResponse.parse({ success: true }));
});

export default router;
