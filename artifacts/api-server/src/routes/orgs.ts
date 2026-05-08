import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, organizationsTable, membershipsTable } from "@workspace/db";
import {
  CreateOrganizationBody,
  GetOrganizationParams,
  GetOrganizationResponse,
  UpdateOrganizationParams,
  UpdateOrganizationBody,
  UpdateOrganizationResponse,
  ListOrganizationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/organizations", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const memberships = await db
    .select({ org: organizationsTable })
    .from(membershipsTable)
    .innerJoin(organizationsTable, eq(membershipsTable.orgId, organizationsTable.id))
    .where(eq(membershipsTable.userId, req.user!.id));

  const orgs = memberships.map((m) => m.org);
  res.json(ListOrganizationsResponse.parse(orgs));
});

router.post("/organizations", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slug = parsed.data.slug ?? parsed.data.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const [org] = await db.insert(organizationsTable).values({
    name: parsed.data.name,
    slug,
    plan: "free",
    ownerId: req.user!.id,
  }).returning();

  await db.insert(membershipsTable).values({
    orgId: org.id,
    userId: req.user!.id,
    role: "owner",
  });

  res.status(201).json(GetOrganizationResponse.parse(org));
});

router.get("/organizations/:orgId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetOrganizationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [membership] = await db.select().from(membershipsTable).where(
    and(
      eq(membershipsTable.orgId, params.data.orgId),
      eq(membershipsTable.userId, req.user!.id),
    )
  );
  if (!membership) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const [org] = await db.select().from(organizationsTable).where(
    eq(organizationsTable.id, params.data.orgId)
  );
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(GetOrganizationResponse.parse(org));
});

router.patch("/organizations/:orgId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = UpdateOrganizationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [membership] = await db.select().from(membershipsTable).where(
    and(
      eq(membershipsTable.orgId, params.data.orgId),
      eq(membershipsTable.userId, req.user!.id),
    )
  );
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [org] = await db
    .update(organizationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizationsTable.id, params.data.orgId))
    .returning();

  res.json(UpdateOrganizationResponse.parse(org));
});

export default router;
