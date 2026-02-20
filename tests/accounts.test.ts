// ABOUTME: Tests for the accounts module covering CRUD, sequence rotation, and alias operations.
// ABOUTME: Uses temp directories to isolate test state from the real filesystem.
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  initSequenceFile,
  loadSequence,
  getNextAccountNumber,
  accountExists,
  addAccountToSequence,
  removeAccountFromSequence,
  getNextInSequence,
  resolveAccountIdentifier,
  setAlias,
  findAccountByAlias,
} from "../src/accounts";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "ccflip-accounts-test-" + Date.now());
const TEST_SEQUENCE = join(TEST_DIR, "sequence.json");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("initSequenceFile", () => {
  test("creates sequence.json if missing", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    expect(existsSync(TEST_SEQUENCE)).toBe(true);
    const data = await loadSequence(TEST_SEQUENCE);
    expect(data.activeAccountNumber).toBeNull();
    expect(data.sequence).toEqual([]);
    expect(data.accounts).toEqual({});
  });

  test("does not overwrite existing file", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const original = await loadSequence(TEST_SEQUENCE);
    original.accounts["1"] = {
      email: "test@test.com",
      uuid: "abc",
      added: new Date().toISOString(),
    };
    const { writeJsonAtomic } = await import("../src/files");
    await writeJsonAtomic(TEST_SEQUENCE, original);

    await initSequenceFile(TEST_SEQUENCE);
    const data = await loadSequence(TEST_SEQUENCE);
    expect(data.accounts["1"]).toBeDefined();
  });
});

describe("getNextAccountNumber", () => {
  test("returns 1 for empty accounts", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    expect(getNextAccountNumber(seq)).toBe(1);
  });

  test("returns max + 1", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    seq.accounts["3"] = { email: "a@b.com", uuid: "x", added: "" };
    seq.accounts["5"] = { email: "c@d.com", uuid: "y", added: "" };
    expect(getNextAccountNumber(seq)).toBe(6);
  });
});

describe("accountExists", () => {
  test("returns false for empty accounts", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    expect(accountExists(seq, "nope@x.com")).toBe(false);
  });

  test("returns true for existing email", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    seq.accounts["1"] = { email: "test@x.com", uuid: "a", added: "" };
    expect(accountExists(seq, "test@x.com")).toBe(true);
  });
});

describe("addAccountToSequence", () => {
  test("adds account and updates sequence", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    const updated = addAccountToSequence(seq, {
      email: "user@test.com",
      uuid: "abc-123",
    });
    expect(updated.accounts["1"].email).toBe("user@test.com");
    expect(updated.sequence).toContain(1);
    expect(updated.activeAccountNumber).toBe(1);
  });

  test("adds account with alias", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    const updated = addAccountToSequence(seq, {
      email: "user@test.com",
      uuid: "abc-123",
      alias: "work",
    });
    expect(updated.accounts["1"].alias).toBe("work");
  });
});

describe("removeAccountFromSequence", () => {
  test("removes account and updates sequence", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    seq = addAccountToSequence(seq, { email: "c@d.com", uuid: "2" });
    const updated = removeAccountFromSequence(seq, "1");
    expect(updated.accounts["1"]).toBeUndefined();
    expect(updated.sequence).not.toContain(1);
    expect(updated.accounts["2"]).toBeDefined();
  });
});

describe("getNextInSequence", () => {
  test("rotates to next account", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    seq = addAccountToSequence(seq, { email: "c@d.com", uuid: "2" });
    seq.activeAccountNumber = 1;
    expect(getNextInSequence(seq)).toBe(2);
  });

  test("wraps around to first", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    seq = addAccountToSequence(seq, { email: "c@d.com", uuid: "2" });
    seq.activeAccountNumber = 2;
    expect(getNextInSequence(seq)).toBe(1);
  });
});

describe("resolveAccountIdentifier", () => {
  test("resolves number string", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    expect(resolveAccountIdentifier(seq, "1")).toBe("1");
  });

  test("resolves email", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    expect(resolveAccountIdentifier(seq, "a@b.com")).toBe("1");
  });

  test("returns null for unknown", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    expect(resolveAccountIdentifier(seq, "nope@x.com")).toBeNull();
  });
});

describe("alias operations", () => {
  test("setAlias assigns alias to account", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    const updated = setAlias(seq, "1", "work");
    expect(updated.accounts["1"].alias).toBe("work");
  });

  test("setAlias rejects duplicate alias", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    seq = addAccountToSequence(seq, { email: "c@d.com", uuid: "2" });
    seq = setAlias(seq, "1", "work");
    expect(() => setAlias(seq, "2", "work")).toThrow(/already in use/i);
  });

  test("findAccountByAlias returns account number", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    let seq = await loadSequence(TEST_SEQUENCE);
    seq = addAccountToSequence(seq, { email: "a@b.com", uuid: "1" });
    seq = setAlias(seq, "1", "work");
    expect(findAccountByAlias(seq, "work")).toBe("1");
  });

  test("findAccountByAlias returns null if not found", async () => {
    await initSequenceFile(TEST_SEQUENCE);
    const seq = await loadSequence(TEST_SEQUENCE);
    expect(findAccountByAlias(seq, "nope")).toBeNull();
  });
});
