import { and, eq, gt } from "drizzle-orm";
import type { NextResponse } from "next/server";
import {
  emailVerificationTokens,
  sessions,
  users,
} from "../db/schema";

export const SESSION_COOKIE = "tuzuo_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_BITS = 256;

type UserRecord = typeof users.$inferSelect;

type RuntimeEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_BASE_URL?: string;
  AUTH_DEV_SHOW_VERIFICATION_LINK?: string;
};

export type PublicUser = {
  id: string;
  email: string;
  role: UserRecord["role"];
  emailVerified: boolean;
};

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function toAuthError(error: unknown) {
  if (error instanceof AuthError) return error;
  if (errorMessageChain(error).includes("no such table")) {
    return new AuthError(
      503,
      "DB_MIGRATION_REQUIRED",
      "账号数据库尚未迁移，请先应用数据库迁移",
    );
  }
  console.error("Auth request failed", error);
  return new AuthError(500, "AUTH_INTERNAL_ERROR", "账号服务暂时不可用");
}

export async function registerWithEmail(
  input: { email?: unknown; password?: unknown },
  request: Request,
) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  validateEmail(email);
  validatePassword(password);

  const db = await getAuthDb();
  const now = Date.now();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser?.emailVerifiedAt) {
    throw new AuthError(409, "EMAIL_ALREADY_REGISTERED", "这个邮箱已经注册");
  }
  if (existingUser?.status === "disabled") {
    throw new AuthError(403, "ACCOUNT_DISABLED", "这个账号暂时不可用");
  }

  const passwordHash = await hashPassword(password);
  const userId = existingUser?.id ?? crypto.randomUUID();
  const user: UserRecord = existingUser
    ? { ...existingUser, passwordHash, updatedAt: now }
    : {
        id: userId,
        email,
        passwordHash,
        role: "user",
        status: "active",
        emailVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };

  if (existingUser) {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userId));
  } else {
    await db.insert(users).values(user);
  }

  const verificationToken = randomToken(32);
  const runtimeEnv = await getRuntimeEnv();
  const verificationUrl = new URL(
    "/api/auth/verify",
    await getAppOrigin(request, runtimeEnv),
  );
  verificationUrl.searchParams.set("token", verificationToken);

  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
  await db.insert(emailVerificationTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await sha256Base64Url(verificationToken),
    expiresAt: now + VERIFICATION_TTL_MS,
    createdAt: now,
  });

  const emailDelivery = await sendVerificationEmail(
    email,
    verificationUrl.toString(),
    runtimeEnv,
  );

  return {
    email,
    emailDelivery,
    verificationUrl: shouldExposeVerificationLink(runtimeEnv)
      ? verificationUrl.toString()
      : null,
  };
}

export async function loginWithEmail(input: {
  email?: unknown;
  password?: unknown;
}) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  validateEmail(email);
  if (!password) {
    throw new AuthError(400, "PASSWORD_REQUIRED", "请输入密码");
  }

  const db = await getAuthDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
  }
  if (user.status === "disabled") {
    throw new AuthError(403, "ACCOUNT_DISABLED", "这个账号暂时不可用");
  }
  if (!user.emailVerifiedAt) {
    throw new AuthError(403, "EMAIL_NOT_VERIFIED", "请先完成邮箱验证");
  }

  const now = Date.now();
  const sessionToken = randomToken(32);
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: await sha256Base64Url(sessionToken),
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
    lastSeenAt: now,
  });

  return {
    sessionToken,
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(request: Request) {
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken) return null;

  const db = await getAuthDb();
  const now = Date.now();
  const tokenHash = await sha256Base64Url(sessionToken);
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || user.status !== "active" || !user.emailVerifiedAt) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, session.id));

  return toPublicUser(user);
}

export async function logoutCurrentSession(request: Request) {
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken) return;
  const db = await getAuthDb();
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, await sha256Base64Url(sessionToken)));
}

export async function verifyEmailToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new AuthError(400, "TOKEN_REQUIRED", "验证链接无效");
  }

  const db = await getAuthDb();
  const now = Date.now();
  const tokenHash = await sha256Base64Url(normalizedToken);
  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!verificationToken) {
    throw new AuthError(400, "TOKEN_INVALID", "验证链接已失效");
  }

  await db
    .update(users)
    .set({ emailVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, verificationToken.userId));
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, verificationToken.userId));
}

export function setSessionCookie(
  response: NextResponse,
  request: Request,
  sessionToken: string,
) {
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
  });
}

export function clearSessionCookie(response: NextResponse, request: Request) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
  });
}

export async function getAppOrigin(request: Request, runtimeEnv?: RuntimeEnv) {
  const resolvedEnv = runtimeEnv ?? (await getRuntimeEnv());
  const configuredOrigin = resolvedEnv.APP_BASE_URL?.trim();
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function getAuthDb() {
  try {
    const { getDb } = await import("../db");
    return getDb();
  } catch {
    throw new AuthError(
      503,
      "DB_NOT_CONFIGURED",
      "账号数据库尚未配置，暂时不能使用账号功能",
    );
  }
}

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const runtimeModule = (await import("cloudflare:workers")) as {
      env?: RuntimeEnv;
    };
    return runtimeModule.env ?? {};
  } catch {
    return {};
  }
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError(400, "EMAIL_INVALID", "请输入有效邮箱");
  }
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new AuthError(400, "PASSWORD_TOO_SHORT", "密码至少需要 8 位");
  }
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

async function sendVerificationEmail(
  email: string,
  verificationUrl: string,
  runtimeEnv: RuntimeEnv,
) {
  if (!runtimeEnv.RESEND_API_KEY || !runtimeEnv.EMAIL_FROM) {
    if (shouldExposeVerificationLink(runtimeEnv)) return "skipped";
    throw new AuthError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "邮箱服务尚未配置，暂时不能注册",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: runtimeEnv.EMAIL_FROM,
      to: email,
      subject: "验证你的图作账号",
      text: `点击链接完成图作账号验证：${verificationUrl}`,
      html: `<p>点击下面的链接完成图作账号验证：</p><p><a href="${escapeHtml(
        verificationUrl,
      )}">验证邮箱</a></p><p>链接 24 小时内有效。</p>`,
    }),
  });

  if (!response.ok) {
    throw new AuthError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "验证邮件发送失败，请稍后重试",
    );
  }

  return "sent";
}

function shouldExposeVerificationLink(runtimeEnv: RuntimeEnv) {
  return runtimeEnv.AUTH_DEV_SHOW_VERIFICATION_LINK === "true";
}

function errorMessageChain(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join("\n").toLowerCase();
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return [
    PASSWORD_ALGORITHM,
    String(PASSWORD_ITERATIONS),
    bytesToBase64Url(salt),
    bytesToBase64Url(derived),
  ].join(":");
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split(":");
  const iterations = Number(iterationsText);
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    !saltText ||
    !hashText
  ) {
    return false;
  }
  const salt = base64UrlToBytes(saltText);
  const expected = base64UrlToBytes(hashText);
  const actual = await derivePassword(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    key,
    PASSWORD_KEY_BITS,
  );
  return new Uint8Array(bits);
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function randomToken(size: number) {
  return bytesToBase64Url(randomBytes(size));
}

function randomBytes(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
