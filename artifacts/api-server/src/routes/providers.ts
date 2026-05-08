import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, providerConfigsTable, workspacesTable, membershipsTable } from "@workspace/db";
import {
  ListProvidersParams,
  ListProvidersResponse,
  SaveProviderConfigParams,
  SaveProviderConfigBody,
  SaveProviderConfigResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function getWorkspaceOrgAccess(workspaceId: string, userId: string, roles?: string[]) {
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  if (!ws) return null;
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, ws.orgId), eq(membershipsTable.userId, userId))
  );
  if (!m) return null;
  if (roles && !roles.includes(m.role)) return null;
  return { ws, member: m, orgId: ws.orgId };
}

const KNOWN_PROVIDERS = [
  "openai", "anthropic", "runwayml", "pika", "sora", "elevenlabs",
  "midjourney", "stability", "kling", "heygen", "synthesia", "deepgram",
];

router.get("/workspaces/:workspaceId/providers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListProvidersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceOrgAccess(params.data.workspaceId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const existing = await db
    .select()
    .from(providerConfigsTable)
    .where(eq(providerConfigsTable.orgId, access.orgId));

  const existingMap = new Map(existing.map((p) => [p.providerKey, p]));

  const all = KNOWN_PROVIDERS.map((name) => {
    const config = existingMap.get(name);
    return {
      id: config?.id ?? null,
      workspaceId: params.data.workspaceId,
      provider: name,
      isActive: config?.configured ?? false,
      hasApiKey: config ? config.encryptedApiKey != null : false,
      settings: {},
      createdAt: config?.createdAt ?? null,
      updatedAt: config?.updatedAt ?? null,
    };
  });

  res.json(ListProvidersResponse.parse(all));
});

router.put("/workspaces/:workspaceId/providers/:provider", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = SaveProviderConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await getWorkspaceOrgAccess(params.data.workspaceId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = SaveProviderConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = {
    orgId: access.orgId,
    providerKey: params.data.provider,
    configured: parsed.data.isActive ?? true,
    encryptedApiKey: parsed.data.apiKey ?? null,
  };

  const [config] = await db
    .insert(providerConfigsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [providerConfigsTable.orgId, providerConfigsTable.providerKey],
      set: {
        configured: values.configured,
        ...(parsed.data.apiKey != null ? { encryptedApiKey: parsed.data.apiKey } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(SaveProviderConfigResponse.parse({
    id: config.id,
    workspaceId: params.data.workspaceId,
    provider: config.providerKey,
    isActive: config.configured,
    hasApiKey: config.encryptedApiKey != null,
    settings: {},
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }));
});

export default router;
