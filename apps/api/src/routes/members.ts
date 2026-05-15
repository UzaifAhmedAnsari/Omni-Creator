import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, membershipsTable, usersTable } from "@workspace/db";
import {
  ListOrgMembersParams,
  ListOrgMembersResponse,
  InviteMemberParams,
  InviteMemberBody,
  UpdateMemberRoleParams,
  UpdateMemberRoleBody,
  UpdateMemberRoleResponse,
  RemoveMemberParams,
  RemoveMemberResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/organizations/:orgId/members", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListOrgMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [self] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!self) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const members = await db
    .select({
      id: membershipsTable.id,
      orgId: membershipsTable.orgId,
      userId: membershipsTable.userId,
      role: membershipsTable.role,
      joinedAt: membershipsTable.createdAt,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(membershipsTable.userId, usersTable.id))
    .where(eq(membershipsTable.orgId, params.data.orgId));

  res.json(ListOrgMembersResponse.parse(members));
});

router.post("/organizations/:orgId/members", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = InviteMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [self] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!self || !["owner", "admin"].includes(self.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = InviteMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!targetUser) {
    res.status(404).json({ error: "User not found — they must sign in to OmniCreator first" });
    return;
  }

  const existing = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, targetUser.id))
  );
  if (existing.length > 0) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  await db.insert(membershipsTable).values({
    orgId: params.data.orgId,
    userId: targetUser.id,
    role: parsed.data.role ?? "viewer",
  });

  res.status(201).json({ success: true });
});

router.patch("/organizations/:orgId/members/:memberId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateMemberRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [self] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!self || !["owner", "admin"].includes(self.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateMemberRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(membershipsTable)
    .set({ role: parsed.data.role })
    .where(eq(membershipsTable.id, params.data.memberId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.json(UpdateMemberRoleResponse.parse(updated));
});

router.delete("/organizations/:orgId/members/:memberId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = RemoveMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [self] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!self || !["owner", "admin"].includes(self.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(membershipsTable).where(eq(membershipsTable.id, params.data.memberId));

  res.json(RemoveMemberResponse.parse({ success: true }));
});

export default router;
