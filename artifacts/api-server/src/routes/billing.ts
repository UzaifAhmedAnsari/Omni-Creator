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

const PLAN_LIMITS: Record<string, { projects: number; storage: number; aiCredits: number }> = {
  free: { projects: 3, storage: 1024, aiCredits: 10 },
  creator: { projects: 25, storage: 10240, aiCredits: 100 },
  pro: { projects: 100, storage: 51200, aiCredits: 500 },
  studio: { projects: 500, storage: 204800, aiCredits: 2000 },
  agency: { projects: 2000, storage: 1024000, aiCredits: 10000 },
  enterprise: { projects: -1, storage: -1, aiCredits: -1 },
};

router.get("/orgs/:orgId/billing", async (req: Request, res: Response): Promise<void> => {
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

  const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free;

  res.json(GetBillingInfoResponse.parse({
    plan: org.plan,
    stripeCustomerId: org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    limits,
    usage: {
      projects: 0,
      storageBytes: 0,
      aiCreditsUsed: 0,
    },
    invoices: [],
    setupRequired: !process.env.STRIPE_SECRET_KEY,
    setupMessage: !process.env.STRIPE_SECRET_KEY
      ? "Stripe is not configured. Add STRIPE_SECRET_KEY to enable billing and plan upgrades."
      : undefined,
  }));
});

router.post("/orgs/:orgId/billing/checkout", async (req: Request, res: Response): Promise<void> => {
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
