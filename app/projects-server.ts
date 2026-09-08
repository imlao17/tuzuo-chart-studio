/**
 * Cloud project storage: per-user chart projects persisted in D1.
 *
 * A project row stores the full editor state as JSON — the same shape as a
 * .tuzuo.json file — plus a display name. Quotas (project count and payload
 * size) keep D1 rows small. Every entry point resolves the session user and
 * scopes reads/writes to that user; ownership mismatches surface as 404 so
 * ids cannot be probed across accounts.
 */
import { and, desc, eq } from "drizzle-orm";
import {
  getCurrentUser,
  AuthError,
} from "./auth-server";
import { projects } from "../db/schema";

export const MAX_PROJECTS_PER_USER = 50;
export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_PROJECT_DATA_BYTES = 1_000_000;

export type CloudProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type CloudProjectRecord = CloudProjectSummary & {
  data: string;
};

async function requireUserId(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthError(401, "NOT_SIGNED_IN", "登录后才能使用云端项目");
  }
  return user.id;
}

async function getProjectsDb() {
  try {
    const { getDb } = await import("../db");
    return getDb();
  } catch {
    throw new AuthError(
      503,
      "DB_NOT_CONFIGURED",
      "项目数据库尚未配置，暂时不能使用云端项目",
    );
  }
}

export function validateName(name: unknown) {
  const normalized = String(name ?? "").trim();
  if (!normalized) return "未命名图表";
  if (normalized.length > MAX_PROJECT_NAME_LENGTH) {
    throw new AuthError(
      400,
      "PROJECT_NAME_TOO_LONG",
      `项目名称最多 ${MAX_PROJECT_NAME_LENGTH} 个字符`,
    );
  }
  return normalized;
}

export function validateData(data: unknown) {
  if (typeof data !== "string" || !data.trim()) {
    throw new AuthError(400, "PROJECT_DATA_REQUIRED", "项目内容不能为空");
  }
  if (data.length > MAX_PROJECT_DATA_BYTES) {
    throw new AuthError(
      413,
      "PROJECT_DATA_TOO_LARGE",
      "项目内容过大，请精简数据后再保存",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new AuthError(400, "PROJECT_DATA_INVALID", "项目内容格式无效");
  }
  // Minimal shape gate: the editor's normalizeProject tolerates partial data,
  // but garbage that isn't even a project object would fail on every open.
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { tableData?: unknown }).tableData) ||
    typeof (parsed as { chartType?: unknown }).chartType !== "string"
  ) {
    throw new AuthError(
      400,
      "PROJECT_DATA_INVALID",
      "项目内容缺少必要的图表字段",
    );
  }
  return data;
}

export async function listCloudProjects(
  request: Request,
): Promise<CloudProjectSummary[]> {
  const userId = await requireUserId(request);
  const db = await getProjectsDb();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
  return rows;
}

export async function createCloudProject(
  request: Request,
  input: { name?: unknown; data?: unknown },
): Promise<CloudProjectSummary> {
  const userId = await requireUserId(request);
  const db = await getProjectsDb();
  const name = validateName(input.name);
  const data = validateData(input.data);

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));
  if (existing.length >= MAX_PROJECTS_PER_USER) {
    throw new AuthError(
      403,
      "PROJECT_QUOTA_EXCEEDED",
      `云端项目最多保存 ${MAX_PROJECTS_PER_USER} 个，请先删除一些再保存`,
    );
  }

  const now = Date.now();
  const [row] = await db
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      userId,
      name,
      data,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });
  return row;
}

async function loadOwnedProject(request: Request, id: string) {
  const userId = await requireUserId(request);
  const db = await getProjectsDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  if (!row) {
    throw new AuthError(404, "PROJECT_NOT_FOUND", "云端项目不存在");
  }
  return row;
}

export async function getCloudProject(
  request: Request,
  id: string,
): Promise<CloudProjectRecord> {
  return loadOwnedProject(request, id);
}

export async function updateCloudProject(
  request: Request,
  id: string,
  input: { name?: unknown; data?: unknown },
): Promise<CloudProjectSummary> {
  const row = await loadOwnedProject(request, id);
  const db = await getProjectsDb();
  const now = Date.now();
  const nextName = input.name === undefined ? row.name : validateName(input.name);
  const nextData = input.data === undefined ? row.data : validateData(input.data);

  const [updated] = await db
    .update(projects)
    .set({ name: nextName, data: nextData, updatedAt: now })
    .where(eq(projects.id, row.id))
    .returning({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });
  return updated;
}

export async function deleteCloudProject(request: Request, id: string) {
  const row = await loadOwnedProject(request, id);
  const db = await getProjectsDb();
  await db.delete(projects).where(eq(projects.id, row.id));
  return { ok: true as const };
}
