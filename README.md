# OmniCreator AI Studio

A multi-tenant SaaS platform for AI video/image creation, editing, social publishing, analytics, and billing.

## 🚀 Quick Start (Docker - Recommended)

```bash
# Start everything (PostgreSQL + API + Frontend)
docker-compose -f docker-compose.dev.yml up
```

Then open http://localhost:3000 in your browser.

**See [DOCKER.md](docs/DOCKER.md) for complete Docker guide including production deployment.**

---

## Run & Operate

### With Docker (Recommended)
- `docker-compose -f docker-compose.dev.yml up` — Start all services
- `docker-compose down` — Stop all services
- See [docs/DOCKER.md](docs/DOCKER.md) for all Docker commands and configuration

### Without Docker (Local Development)
- `pnpm install` — Install dependencies
- `pnpm --filter @workspace/api run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/web run dev` — run the frontend (port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter (routing), TanStack Query, shadcn/ui + Tailwind, recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit Auth (OIDC/PKCE)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/omnicreator/` — React/Vite frontend, served at `/`
- `artifacts/api-server/` — Express API server, served at `/api`
- `lib/api-spec/` — OpenAPI spec (source of truth for contracts)
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks + schemas (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/` — Drizzle ORM schema + migrations

## Frontend Pages

- `/` — Login/landing page
- `/onboarding` — New user org/workspace setup
- `/w/:workspaceId` — Dashboard
- `/w/:workspaceId/projects` — Projects list + create
- `/w/:workspaceId/projects/:projectId` — Project detail + AI generation
- `/w/:workspaceId/assets` — Asset library
- `/w/:workspaceId/ai-jobs` — AI job monitor
- `/w/:workspaceId/social` — Social account connections
- `/w/:workspaceId/publishing` — Publishing scheduler
- `/w/:workspaceId/analytics` — Analytics & recommendations
- `/org/:orgId/settings` — Settings (org, members, brand kits, AI providers, billing)
- `/admin` — Platform admin panel

## Architecture Decisions

- All generated hooks take a plain string ID as the first arg, e.g. `useGetWorkspace(workspaceId)` — never pass an object.
- `{ enabled }` option cannot be passed to generated hooks without a full `UseQueryOptions` cast; instead hooks are called with an empty string and data is handled gracefully via `??` fallbacks.
- `OrgMember` is exported as `Member` from `@workspace/api-client-react`.
- `SocialAccount.platform` is a `SocialAccountPlatform` enum; use `String(account.platform)` for string comparisons.
- `AiJob` has a `prompt` field directly — no `parameters.prompt` wrapping.
- `WorkspaceAnalytics` tracks `projectsCreated`, `assetsGenerated`, `publishingSuccessRate`, `totalCreditsUsed` — no social engagement metrics.

## Product

OmniCreator AI Studio lets teams create AI-powered videos, images, and carousels; manage brand kits; connect social accounts; schedule posts; track analytics; and manage credits — all from a single multi-tenant workspace.

## User Preferences

- Show setup-required states gracefully when external credentials (AI keys, Stripe, OAuth) are missing.
- No mocked data — all UI is wired to real API endpoints.

## Gotchas

- AI provider API keys must be configured in Settings → AI Providers before generation jobs will succeed.
- Stripe is not configured; billing UI shows plan info but upgrades are disabled.
- Social OAuth requires platform developer credentials; Connect buttons are disabled until configured.
- `pnpm --filter @workspace/db run push` must be run after schema changes before the API server will work.
- Never run `pnpm dev` at workspace root.
