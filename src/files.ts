// ABOUTME: Atomic JSON file writing and directory-based file locking.
// ABOUTME: Prevents data corruption by writing to temp files and renaming into place.

import { existsSync, mkdirSync, rmSync, chmodSync, renameSync, writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { randomBytes } from "crypto";

// Write JSON atomically: write to temp file, validate, then rename into place.
export async function writeJsonAtomic(
  filePath: string,
  data: unknown
): Promise<void> {
  const jsonStr = JSON.stringify(data, null, 2);

  // Validate by parsing back
  JSON.parse(jsonStr);

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  chmodSync(dir, 0o700);

  const tempFile = `${filePath}.${Date.now()}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(tempFile, jsonStr, { mode: 0o600, flag: "wx" });
    renameSync(tempFile, filePath);
    chmodSync(filePath, 0o600);
  } catch (err) {
    // Clean up temp file on failure
    try {
      rmSync(tempFile, { force: true });
    } catch {}
    throw err;
  }
}

// Acquire a cross-platform directory-based lock.
export function acquireLock(lockDir: string): void {
  const parentDir = dirname(lockDir);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true, mode: 0o700 });
  }
  try {
    mkdirSync(lockDir, { recursive: false, mode: 0o700 });
    writeLockOwner(lockDir);
    return;
  } catch (err: unknown) {
    const code =
      err instanceof Error && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "EEXIST") {
      if (isStaleLock(lockDir)) {
        rmSync(lockDir, { recursive: true, force: true });
        mkdirSync(lockDir, { recursive: false, mode: 0o700 });
        writeLockOwner(lockDir);
        return;
      }
      throw new Error(
        `Another instance is running. If this is wrong, remove ${lockDir}`
      );
    }
    if (err instanceof Error) {
      throw new Error(`Failed to acquire lock at ${lockDir}: ${err.message}`);
    }
    throw new Error(`Failed to acquire lock at ${lockDir}`);
  }
}

// Release directory-based lock.
export function releaseLock(lockDir: string): void {
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch {}
}

function getLockOwnerPath(lockDir: string): string {
  return join(lockDir, "owner.json");
}

function writeLockOwner(lockDir: string): void {
  const ownerPath = getLockOwnerPath(lockDir);
  const owner = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(ownerPath, JSON.stringify(owner), { mode: 0o600 });
  chmodSync(lockDir, 0o700);
}

function isStaleLock(lockDir: string): boolean {
  const ownerPath = getLockOwnerPath(lockDir);
  if (!existsSync(ownerPath)) {
    return true;
  }

  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf-8")) as { pid?: number };
    if (!owner.pid || !Number.isInteger(owner.pid) || owner.pid <= 0) {
      return true;
    }
    return !isProcessAlive(owner.pid);
  } catch {
    return true;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ESRCH") return false;
      if (code === "EPERM") return true;
    }
    return true;
  }
}
