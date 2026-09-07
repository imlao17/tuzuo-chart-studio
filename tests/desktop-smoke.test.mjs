import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const applicationBinary = resolve(
  "release",
  "mac-arm64",
  "图作.app",
  "Contents",
  "MacOS",
  "图作",
);

test("packaged macOS application opens the editor and exits cleanly", async () => {
  const child = spawn(applicationBinary, [], {
    env: { ...process.env, TUZUO_DESKTOP_SMOKE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const exitCode = await new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      rejectExit(new Error(`Desktop smoke test timed out.\n${output}`));
    }, 20_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });

  assert.equal(exitCode, 0, output);
  assert.match(output, /TUZUO_DESKTOP_READY:图作 · 透明图表工具/);
});
