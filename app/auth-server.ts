import { and, eq, gt, lt, ne } from "drizzle-orm";
import type { NextResponse } from "next/server";
import {
  authRateLimits,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
} from "../db/schema";

export const SESSION_COOKIE = "tuzuo_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_BITS = 256;
const AUTH_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 15;
const AUTH_RATE_LIMITS = {
  login: 10,
  register: 5,
  passwordReset: 5,
  resetPassword: 10,
  changePassword: 10,
} as const;

type UserRecord = typeof users.$inferSelect;

type RuntimeEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_BASE_URL?: string;
  AUTH_DEV_SHOW_VERIFICATION_LINK?: string;
};

type AuthRateLimitAction = keyof typeof AUTH_RATE_LIMITS;

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
  await enforceAuthRateLimit(db, "register", request, email);
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

export async function loginWithEmail(
  input: {
    email?: unknown;
    password?: unknown;
  },
  request: Request,
) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  validateEmail(email);
  if (!password) {
    throw new AuthError(400, "PASSWORD_REQUIRED", "请输入密码");
  }

  const db = await getAuthDb();
  await enforceAuthRateLimit(db, "login", request, email);
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

  // Housekeeping: drop expired rows so the tables don't grow forever.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, now));

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

export async function requestPasswordReset(
  input: { email?: unknown },
  request: Request,
) {
  const email = normalizeEmail(input.email);
  validateEmail(email);

  const db = await getAuthDb();
  await enforceAuthRateLimit(db, "passwordReset", request, email);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Never reveal whether the address is registered; the response shape is
  // identical either way. The reset link only comes back in local dev mode.
  if (!user || user.status === "disabled") {
    return {
      emailDelivery: "skipped" as const,
      resetUrl: null,
    };
  }

  const now = Date.now();
  const resetToken = randomToken(32);
  const runtimeEnv = await getRuntimeEnv();
  const resetUrl = new URL(
    "/reset-password",
    await getAppOrigin(request, runtimeEnv),
  );
  resetUrl.searchParams.set("token", resetToken);

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: await sha256Base64Url(resetToken),
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    createdAt: now,
  });

  const emailDelivery = await sendPasswordResetEmail(
    email,
    resetUrl.toString(),
    runtimeEnv,
  );

  return {
    emailDelivery,
    resetUrl: shouldExposeVerificationLink(runtimeEnv)
      ? resetUrl.toString()
      : null,
  };
}

export async function resetPasswordWithToken(
  input: { token?: unknown; password?: unknown },
  request: Request,
) {
  const token = String(input.token ?? "").trim();
  const password = String(input.password ?? "");
  if (!token) {
    throw new AuthError(400, "TOKEN_REQUIRED", "重置链接无效");
  }
  validatePassword(password);

  const db = await getAuthDb();
  await enforceAuthRateLimit(db, "resetPassword", request, token.slice(0, 16));
  const now = Date.now();
  const [resetRecord] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, await sha256Base64Url(token)),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!resetRecord) {
    throw new AuthError(400, "TOKEN_INVALID", "重置链接已失效，请重新获取");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, resetRecord.userId))
    .limit(1);

  if (!user || user.status === "disabled") {
    throw new AuthError(403, "ACCOUNT_DISABLED", "这个账号暂时不可用");
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      updatedAt: now,
    })
    .where(eq(users.id, resetRecord.userId));
  // A reset invalidates every existing session for the account.
  await db
    .delete(sessions)
    .where(eq(sessions.userId, resetRecord.userId));
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, resetRecord.userId));

  return { ok: true as const };
}

export async function changePassword(
  input: { currentPassword?: unknown; newPassword?: unknown },
  request: Request,
) {
  const currentPassword = String(input.currentPassword ?? "");
  const newPassword = String(input.newPassword ?? "");
  if (!currentPassword) {
    throw new AuthError(400, "PASSWORD_REQUIRED", "请输入当前密码");
  }
  validatePassword(newPassword);
  if (currentPassword === newPassword) {
    throw new AuthError(400, "PASSWORD_UNCHANGED", "新密码不能与当前密码相同");
  }

  const db = await getAuthDb();
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken) {
    throw new AuthError(401, "NOT_SIGNED_IN", "请先登录");
  }
  await enforceAuthRateLimit(
    db,
    "changePassword",
    request,
    sessionToken.slice(0, 16),
  );
  const now = Date.now();
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.tokenHash, await sha256Base64Url(sessionToken)), gt(sessions.expiresAt, now)),
    )
    .limit(1);
  if (!session) {
    throw new AuthError(401, "NOT_SIGNED_IN", "请先登录");
  }
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || user.status !== "active" || !user.emailVerifiedAt) {
    throw new AuthError(401, "NOT_SIGNED_IN", "请先登录");
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "当前密码不正确");
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: now })
    .where(eq(users.id, user.id));
  // Keep the current session, drop every other device.
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), ne(sessions.id, session.id)));

  return { ok: true as const };
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
  if (configuredOrigin) return normalizeConfiguredOrigin(configuredOrigin);
  const url = new URL(request.url);
  if (isLocalOrigin(url) || shouldExposeVerificationLink(resolvedEnv)) {
    return `${url.protocol}//${url.host}`;
  }
  throw new AuthError(
    503,
    "APP_BASE_URL_REQUIRED",
    "生产环境需要配置 APP_BASE_URL 才能生成邮箱验证链接",
  );
}

function normalizeConfiguredOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    return url.origin;
  } catch {
    throw new AuthError(
      503,
      "APP_BASE_URL_INVALID",
      "APP_BASE_URL 需要是完整的 http 或 https 地址",
    );
  }
}

function isLocalOrigin(url: URL) {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "0.0.0.0" ||
    url.hostname === "::1"
  );
}

async function enforceAuthRateLimit(
  db: Awaited<ReturnType<typeof getAuthDb>>,
  action: AuthRateLimitAction,
  request: Request,
  email: string,
) {
  const now = Date.now();
  const limit = AUTH_RATE_LIMITS[action];
  const windowStart = now - AUTH_RATE_LIMIT_WINDOW_MS;
  const clientHash = await sha256Base64Url(getClientIp(request));
  const emailHash = await sha256Base64Url(email);
  const key = `${action}:${clientHash}:${emailHash}`;

  const [record] = await db
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.key, key))
    .limit(1);

  if (record && record.windowStart > windowStart) {
    if (record.count >= limit) {
      throw new AuthError(
        429,
        "AUTH_RATE_LIMITED",
        "尝试次数过多，请稍后再试",
      );
    }
    await db
      .update(authRateLimits)
      .set({ count: record.count + 1, updatedAt: now })
      .where(eq(authRateLimits.key, key));
    return;
  }

  const nextRecord = {
    key,
    count: 1,
    windowStart: now,
    updatedAt: now,
  };

  if (record) {
    await db
      .update(authRateLimits)
      .set(nextRecord)
      .where(eq(authRateLimits.key, key));
    return;
  }

  try {
    await db.insert(authRateLimits).values(nextRecord);
  } catch {
    await db
      .update(authRateLimits)
      .set(nextRecord)
      .where(eq(authRateLimits.key, key));
  }
}

function getClientIp(request: Request) {
  const forwarded =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown-client";
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

export function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError(400, "EMAIL_INVALID", "请输入有效邮箱");
  }
}

export function validatePassword(password: string) {
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

async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  runtimeEnv: RuntimeEnv,
) {
  if (!runtimeEnv.RESEND_API_KEY || !runtimeEnv.EMAIL_FROM) {
    if (shouldExposeVerificationLink(runtimeEnv)) return "skipped";
    throw new AuthError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "邮箱服务尚未配置，暂时不能发送重置邮件",
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
      subject: "重置你的图作密码",
      text: `点击链接重置图作账号密码：${resetUrl}`,
      html: `<p>点击下面的链接重置图作账号密码：</p><p><a href="${escapeHtml(
        resetUrl,
      )}">重置密码</a></p><p>链接 30 分钟内有效。如果这不是你的操作，请忽略这封邮件。</p>`,
    }),
  });

  if (!response.ok) {
    throw new AuthError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "重置邮件发送失败，请稍后重试",
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

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return [
    PASSWORD_ALGORITHM,
    String(PASSWORD_ITERATIONS),
    bytesToBase64Url(salt),
    bytesToBase64Url(derived),
  ].join(":");
}

export async function verifyPassword(password: string, storedHash: string) {
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
  try {
    const salt = base64UrlToBytes(saltText);
    const expected = base64UrlToBytes(hashText);
    const actual = await derivePassword(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
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

export async function sha256Base64Url(value: string) {
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
