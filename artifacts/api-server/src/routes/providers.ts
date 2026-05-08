import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, providerConfigsTable, membershipsTable } from "@workspace/db";
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

async function checkOrgAccess(orgId: string, userId: string, roles?: string[]) {
  const [m] = await db.select().from(membershipsTable).where(
    and(eq(membershipsTable.orgId, orgId), eq(membershipsTable.userId, userId))
  );
  if (!m) return null;
  if (roles && !roles.includes(m.role)) return null;
  return m;
}

const KNOWN_PROVIDERS: Array<{ key: string; name: string; taskTypes: string[] }> = [
  { key: "openai", name: "OpenAI", taskTypes: ["text_to_image", "voiceover", "caption"] },
  { key: "anthropic", name: "Anthropic", taskTypes: ["caption", "text_generation"] },
  { key: "runwayml", name: "Runway ML", taskTypes: ["text_to_video", "image_to_video"] },
  { key: "pika", name: "Pika Labs", taskTypes: ["text_to_video", "image_to_video"] },
  { key: "sora", name: "Sora (OpenAI)", taskTypes: ["text_to_video"] },
  { key: "elevenlabs", name: "ElevenLabs", taskTypes: ["voiceover"] },
  { key: "midjourney", name: "Midjourney", taskTypes: ["text_to_image"] },
  { key: "stability", name: "Stability AI", taskTypes: ["text_to_image", "upscale"] },
  { key: "kling", name: "Kling", taskTypes: ["text_to_video", "image_to_video"] },
  { key: "heygen", name: "HeyGen", taskTypes: ["text_to_video"] },
  { key: "synthesia", name: "Synthesia", taskTypes: ["text_to_video"] },
  { key: "deepgram", name: "Deepgram", taskTypes: ["caption"] },
];

router.get("/organizations/:orgId/providers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = ListProvidersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await checkOrgAccess(params.data.orgId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const existing = await db
    .select()
    .from(providerConfigsTable)
    .where(eq(providerConfigsTable.orgId, params.data.orgId));

  const existingMap = new Map(existing.map((p) => [p.providerKey, p]));

  const all = KNOWN_PROVIDERS.map((info) => {
    const config = existingMap.get(info.key);
    return {
      providerKey: info.key,
      name: info.name,
      configured: config?.configured ?? false,
      taskTypes: info.taskTypes,
      isDefault: false,
      createdAt: config?.createdAt?.toISOString() ?? new Date(0).toISOString(),
    };
  });

  res.json(ListProvidersResponse.parse(all));
});

router.post("/organizations/:orgId/providers", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = SaveProviderConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const access = await checkOrgAccess(params.data.orgId, req.user!.id, ["owner", "admin"]);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = SaveProviderConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const providerInfo = KNOWN_PROVIDERS.find((p) => p.key === parsed.data.providerKey);

  const values = {
    orgId: params.data.orgId,
    providerKey: parsed.data.providerKey,
    configured: parsed.data.apiKey != null ? true : (parsed.data.isDefault ?? false),
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
    providerKey: config.providerKey,
    name: providerInfo?.name ?? config.providerKey,
    configured: config.configured,
    taskTypes: providerInfo?.taskTypes ?? [],
    isDefault: parsed.data.isDefault ?? false,
    createdAt: config.createdAt.toISOString(),
  }));
});

export default router;
