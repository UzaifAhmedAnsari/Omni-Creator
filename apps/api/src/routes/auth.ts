import * as oidc from "openid-client";
import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  hashPassword,
  verifyPassword,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = getHeaderValue(req.headers["x-forwarded-proto"]);

  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return req.secure;
}

function getOrigin(req: Request): string {
  const forwardedProto = getHeaderValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = getHeaderValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost || req.headers.host || "localhost";

  const proto = forwardedProto
    ? forwardedProto.split(",")[0]?.trim()
    : isSecureRequest(req)
      ? "https"
      : "http";

  return `${proto}://${host}`;
}

function setSessionCookie(req: Request, res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(req: Request, res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function clearOidcCookies(req: Request, res: Response) {
  const options = {
    path: "/",
    secure: isSecureRequest(req),
    sameSite: "lax" as const,
  };

  res.clearCookie("code_verifier", options);
  res.clearCookie("nonce", options);
  res.clearCookie("state", options);
  res.clearCookie("return_to", options);
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const result = await pool.query(
    `INSERT INTO users (id, email, first_name, last_name, profile_image_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       profile_image_url = EXCLUDED.profile_image_url,
       updated_at = NOW()
     RETURNING
       id,
       email,
       first_name AS "firstName",
       last_name AS "lastName",
       profile_image_url AS "profileImageUrl"`,
    [
      userData.id,
      userData.email,
      userData.firstName,
      userData.lastName,
      userData.profileImageUrl,
    ],
  );

  return result.rows[0] as AuthUser;
}

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function buildAuthUser(user: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  profileImageUrl?: string | null;
  profile_image_url?: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.firstName ?? user.first_name ?? null,
    lastName: user.lastName ?? user.last_name ?? null,
    profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? null,
  };
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/signup", async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const firstName =
    typeof req.body?.firstName === "string" ? req.body.firstName.trim() : null;
  const lastName =
    typeof req.body?.lastName === "string" ? req.body.lastName.trim() : null;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const existingResult = await pool.query(
    `SELECT
       id,
       email,
       password_hash,
       password_salt,
       first_name,
       last_name,
       profile_image_url
     FROM users
     WHERE email = $1`,
    [email],
  );

  const existingUser = existingResult.rows[0];

  if (existingUser) {
    res.status(409).json({
      error: existingUser.password_hash
        ? "A user already exists with that email. Please login instead."
        : "A Replit-authenticated account already exists with that email. Please sign in with Replit.",
    });
    return;
  }

  const { salt, hash } = hashPassword(password);
  const userId = crypto.randomUUID();

  const insertResult = await pool.query(
    `INSERT INTO users (id, email, first_name, last_name, password_hash, password_salt)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, profile_image_url`,
    [userId, email, firstName, lastName, hash, salt],
  );

  const userData = buildAuthUser(insertResult.rows[0]);

  const sessionData: SessionData = {
    user: userData,
    access_token: "",
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL / 1000,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(req, res, sid);

  res.status(201).json({ user: userData });
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const result = await pool.query(
    `SELECT
       id,
       email,
       password_hash,
       password_salt,
       first_name,
       last_name,
       profile_image_url
     FROM users
     WHERE email = $1`,
    [email],
  );

  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (!user.password_hash || !user.password_salt) {
    res.status(403).json({
      error:
        "This account was created via Replit login. Please sign in with Replit or create a new account.",
    });
    return;
  }

  if (!verifyPassword(password, user.password_salt, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const userData = buildAuthUser(user);

  const sessionData: SessionData = {
    user: userData,
    access_token: "",
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL / 1000,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(req, res, sid);

  res.json({ user: userData });
});

router.get("/login", async (req: Request, res: Response) => {
  if (!process.env.REPL_ID) {
    res.status(503).json({
      error: "Replit login is not configured. REPL_ID is missing.",
    });
    return;
  }

  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(req, res, "code_verifier", codeVerifier);
  setOidcCookie(req, res, "nonce", nonce);
  setOidcCookie(req, res, "state", state);
  setOidcCookie(req, res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;

  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  clearOidcCookies(req, res);

  const claims = tokens.claims();

  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

  const now = Math.floor(Date.now() / 1000);

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(req, res, sid);

  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);
  const sid = getSessionId(req);

  await clearSession(res, sid);

  if (!process.env.REPL_ID) {
    res.redirect(origin);
    return;
  }

  const config = await getOidcConfig();

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();

      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);

      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);

      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);

  if (sid) {
    await deleteSession(sid);
  }

  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;