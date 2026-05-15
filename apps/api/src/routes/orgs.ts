import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isPgError(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

router.get(
  "/organizations",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const result = await pool.query(
      `SELECT
        o.id,
        o.name,
        COALESCE(o.slug, '') AS slug,
        o.logo_url AS "logoUrl",
        o.plan,
        o.owner_id AS "ownerId",
        o.credits_balance AS "creditsBalance",
        o.created_at::text AS "createdAt",
        o.updated_at::text AS "updatedAt"
      FROM memberships m
      INNER JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = $1
      ORDER BY o.created_at DESC`,
      [req.user!.id],
    );

    res.json(ListOrganizationsResponse.parse(result.rows));
  },
);

router.post(
  "/organizations",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const parsed = CreateOrganizationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const organizationId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.name);
    const slug = baseSlug || `org-${organizationId.slice(0, 8)}`;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO organizations (id, name, slug, plan, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id,
           name,
           COALESCE(slug, '') AS slug,
           logo_url AS "logoUrl",
           plan,
           owner_id AS "ownerId",
           credits_balance AS "creditsBalance",
           created_at::text AS "createdAt",
           updated_at::text AS "updatedAt"`,
        [organizationId, parsed.data.name, slug, "free", req.user!.id],
      );

      const org = result.rows[0];

      await client.query(
        `INSERT INTO memberships (id, org_id, user_id, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [membershipId, org.id, req.user!.id, "owner"],
      );

      await client.query("COMMIT");

      res.status(201).json(GetOrganizationResponse.parse(org));
    } catch (error: unknown) {
      await client.query("ROLLBACK");

      if (isPgError(error) && error.code === "23505") {
        res.status(409).json({
          error: "Organization slug already exists. Please choose another name.",
        });
        return;
      }

      throw error;
    } finally {
      client.release();
    }
  },
);

router.get(
  "/organizations/:orgId",
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    const params = GetOrganizationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const membershipResult = await pool.query(
      `SELECT 1
       FROM memberships
       WHERE org_id = $1 AND user_id = $2
       LIMIT 1`,
      [params.data.orgId, req.user!.id],
    );

    if (membershipResult.rowCount === 0) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const orgResult = await pool.query(
      `SELECT
         id,
         name,
         COALESCE(slug, '') AS slug,
         logo_url AS "logoUrl",
         plan,
         owner_id AS "ownerId",
         credits_balance AS "creditsBalance",
         created_at::text AS "createdAt",
         updated_at::text AS "updatedAt"
       FROM organizations
       WHERE id = $1`,
      [params.data.orgId],
    );

    if (orgResult.rowCount === 0) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    res.json(GetOrganizationResponse.parse(orgResult.rows[0]));
  },
);

router.patch(
  "/organizations/:orgId",
  async (req: Request, res: Response): Promise<void> => {
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

    const membershipResult = await pool.query(
      `SELECT role
       FROM memberships
       WHERE org_id = $1 AND user_id = $2
       LIMIT 1`,
      [params.data.orgId, req.user!.id],
    );

    if (
      membershipResult.rowCount === 0 ||
      !["owner", "admin"].includes(membershipResult.rows[0].role)
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updateValues: unknown[] = [];
    const updateClauses: string[] = [];

    if (parsed.data.name !== undefined) {
      updateClauses.push(`name = $${updateValues.length + 1}`);
      updateValues.push(parsed.data.name);
    }

    if (parsed.data.logoUrl !== undefined) {
      updateClauses.push(`logo_url = $${updateValues.length + 1}`);
      updateValues.push(parsed.data.logoUrl);
    }

    if (updateClauses.length === 0) {
      res.status(400).json({
        error: "No valid organization fields provided to update.",
      });
      return;
    }

    updateValues.push(params.data.orgId, req.user!.id);

    const orgIdPlaceholder = `$${updateValues.length - 1}`;
    const userIdPlaceholder = `$${updateValues.length}`;

    const updatedResult = await pool.query(
      `UPDATE organizations
       SET ${updateClauses.join(", ")}, updated_at = NOW()
       WHERE id = ${orgIdPlaceholder}
         AND EXISTS (
           SELECT 1
           FROM memberships
           WHERE org_id = ${orgIdPlaceholder}
             AND user_id = ${userIdPlaceholder}
         )
       RETURNING
         id,
         name,
         COALESCE(slug, '') AS slug,
         logo_url AS "logoUrl",
         plan,
         owner_id AS "ownerId",
         credits_balance AS "creditsBalance",
         created_at::text AS "createdAt",
         updated_at::text AS "updatedAt"`,
      updateValues,
    );

    if (updatedResult.rowCount === 0) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    res.json(UpdateOrganizationResponse.parse(updatedResult.rows[0]));
  },
);

export default router;