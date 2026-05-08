import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, ilike } from "drizzle-orm";
import { db, templatesTable, projectsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListTemplatesQueryParams,
  ListTemplatesResponse,
  GetTemplateParams,
  GetTemplateResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/templates", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const query = ListTemplatesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.search) {
    conditions.push(ilike(templatesTable.name, `%${query.data.search}%`));
  }

  const templates = await db
    .select()
    .from(templatesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(templatesTable.createdAt))
    .limit(query.data.limit ?? 50);

  res.json(ListTemplatesResponse.parse(templates));
});

router.get("/templates/:templateId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(eq(templatesTable.id, params.data.templateId));

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json(GetTemplateResponse.parse(template));
});

export default router;
