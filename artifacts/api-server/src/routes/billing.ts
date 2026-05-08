import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, organizationsTable, membershipsTable } from "@workspace/db";
import {
  GetBillingInfoParams,
  GetBillingInfoResponse,
  CreateCheckoutSessionParams,
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/organizations/:orgId/billing", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetBillingInfoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!m || !["owner", "admin"].includes(m.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, params.data.orgId));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(GetBillingInfoResponse.parse({
    orgId: org.id,
    plan: org.plan,
    creditsBalance: org.creditsBalance ?? 0,
    creditsUsedThisPeriod: 0,
    periodEnd: null,
    stripeCustomerId: org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    invoices: [],
  }));
});

router.post("/organizations/:orgId/billing/checkout", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = CreateCheckoutSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, params.data.orgId), eq(membershipsTable.userId, req.user!.id))
  );
  if (!m || m.role !== "owner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.status(503).json(CreateCheckoutSessionResponse.parse({
    setupRequired: true,
    message: "Stripe is not configured. Add STRIPE_SECRET_KEY to activate checkout.",
    url: null,
  }));
});

export default router;
