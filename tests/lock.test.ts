// ABOUTME: Regression tests for lock lifecycle in CLI commands.
// ABOUTME: Ensures lock directory is released even when command exits with an error.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("lock cleanup", () => {
  test("ccflip add releases lock on error", async () => {
    const testHome = mkdtempSync(join(tmpdir(), "ccflip-lock-test-"));
    const lockPath = join(testHome, ".claude-switch-backup", ".lock");

    const proc = Bun.spawn(
      ["bun", "run", "src/index.ts", "add"],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: testHome },
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);
    expect(existsSync(lockPath)).toBe(false);

    rmSync(testHome, { recursive: true, force: true });
  });
});
