import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthError,
  hashPassword,
  normalizeEmail,
  sha256Base64Url,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "../app/auth-server";
import {
  MAX_PROJECT_DATA_BYTES,
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECTS_PER_USER,
  validateData,
  validateName,
} from "../app/projects-server";
import { isFreeExportAction } from "../src/studio/types";

test("auth: normalizeEmail normalizes whitespace and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.COM  "), "user@example.com");
  assert.equal(normalizeEmail(""), "");
  assert.equal(normalizeEmail(null), "");
});

test("auth: validateEmail accepts valid formats and rejects invalid", () => {
  assert.doesNotThrow(() => validateEmail("hello@domain.com"));
  assert.doesNotThrow(() => validateEmail("user.name+tag@sub.example.co"));

  assert.throws(
    () => validateEmail("not-an-email"),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "EMAIL_INVALID" &&
      err.status === 400,
  );
  assert.throws(
    () => validateEmail("user@domain"),
    (err: unknown) =>
      err instanceof AuthError && err.code === "EMAIL_INVALID",
  );
});

test("auth: validatePassword checks length", () => {
  assert.doesNotThrow(() => validatePassword("12345678"));
  assert.doesNotThrow(() => validatePassword("very-strong-secret-key"));

  assert.throws(
    () => validatePassword("1234567"),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PASSWORD_TOO_SHORT" &&
      err.status === 400,
  );
});

test("auth: hashPassword and verifyPassword round-trip correctly", async () => {
  const secret = "correct-horse-battery-staple";
  const hash = await hashPassword(secret);

  assert.ok(hash.startsWith("pbkdf2-sha256:310000:"), "uses PBKDF2-SHA256 with 310k rounds");

  const correct = await verifyPassword(secret, hash);
  assert.equal(correct, true, "correct password verifies");

  const wrong = await verifyPassword("incorrect-password", hash);
  assert.equal(wrong, false, "wrong password rejected");

  const corrupted = await verifyPassword(secret, hash.replace(/:[^:]+$/, ":corruptedhash"));
  assert.equal(corrupted, false, "corrupted hash rejected");

  const badAlgorithm = await verifyPassword(secret, `md5:1000:${hash.split(":").slice(2).join(":")}`);
  assert.equal(badAlgorithm, false, "unknown algorithm rejected");
});

test("auth: sha256Base64Url produces valid base64url digests", async () => {
  const digest1 = await sha256Base64Url("test-token-value");
  const digest2 = await sha256Base64Url("test-token-value");
  const digest3 = await sha256Base64Url("different-token-value");

  assert.equal(digest1, digest2, "identical inputs yield identical digests");
  assert.notEqual(digest1, digest3, "different inputs yield different digests");
  assert.ok(/^[A-Za-z0-9_-]+$/.test(digest1), "digest is URL-safe base64");
});

test("projects: validateName enforces length and defaults empty", () => {
  assert.equal(validateName(""), "未命名图表");
  assert.equal(validateName("   "), "未命名图表");
  assert.equal(validateName(null), "未命名图表");
  assert.equal(validateName("2026年销售报表"), "2026年销售报表");

  const maxValidName = "a".repeat(MAX_PROJECT_NAME_LENGTH);
  assert.equal(validateName(maxValidName), maxValidName);

  const tooLongName = "a".repeat(MAX_PROJECT_NAME_LENGTH + 1);
  assert.throws(
    () => validateName(tooLongName),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PROJECT_NAME_TOO_LONG" &&
      err.status === 400,
  );
});

test("projects: validateData enforces string, JSON validity, and size quota", () => {
  assert.throws(
    () => validateData(""),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PROJECT_DATA_REQUIRED" &&
      err.status === 400,
  );
  assert.throws(
    () => validateData("not json"),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PROJECT_DATA_INVALID" &&
      err.status === 400,
  );

  const validJson = JSON.stringify({ chartType: "bar", tableData: [["A", "B"], ["1", "2"]] });
  assert.equal(validateData(validJson), validJson);

  assert.throws(
    () => validateData(JSON.stringify({ note: "not a project" })),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PROJECT_DATA_INVALID" &&
      err.status === 400,
  );
  assert.throws(
    () => validateData(JSON.stringify({ chartType: 42 })),
    (err: unknown) => err instanceof AuthError && err.code === "PROJECT_DATA_INVALID",
  );

  const oversizedData = JSON.stringify({ padding: "x".repeat(MAX_PROJECT_DATA_BYTES + 10) });
  assert.throws(
    () => validateData(oversizedData),
    (err: unknown) =>
      err instanceof AuthError &&
      err.code === "PROJECT_DATA_TOO_LARGE" &&
      err.status === 413,
  );
});

test("projects: quota constant is set", () => {
  assert.equal(MAX_PROJECTS_PER_USER, 50);
});

test("export: isFreeExportAction enforces freemium tiered permissions", () => {
  // Free actions: copy, svg, project file save
  assert.equal(isFreeExportAction({ type: "copy" }), true, "copy png is free");
  assert.equal(isFreeExportAction({ type: "svg" }), true, "svg export is free");
  assert.equal(isFreeExportAction({ type: "project" }), true, "project file save is free");

  // PNG ratios: 1x and 2x are free
  assert.equal(isFreeExportAction({ type: "png", ratio: 1 }), true, "1x png is free");
  assert.equal(isFreeExportAction({ type: "png", ratio: 2 }), true, "2x png is free");

  // PNG ratios: 4x and above require auth
  assert.equal(isFreeExportAction({ type: "png", ratio: 4 }), false, "4x png requires auth");
  assert.equal(isFreeExportAction({ type: "png", ratio: 8 }), false, "8x png requires auth");

  // Undefined or unknown action requires auth if gating is on
  assert.equal(isFreeExportAction(undefined), false, "unspecified action requires auth");
});

