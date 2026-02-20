// ABOUTME: Core accounts module managing sequence.json for multi-account CRUD operations.
// ABOUTME: Handles account addition, removal, sequence rotation, identifier resolution, and aliases.
import { existsSync } from "fs";
import { writeJsonAtomic } from "./files";

export interface Account {
  email: string;
  uuid: string;
  added: string;
  alias?: string;
}

export interface SequenceData {
  activeAccountNumber: number | null;
  lastUpdated: string;
  sequence: number[];
  accounts: Record<string, Account>;
}

export async function initSequenceFile(path: string): Promise<void> {
  if (existsSync(path)) return;
  const data: SequenceData = {
    activeAccountNumber: null,
    lastUpdated: new Date().toISOString(),
    sequence: [],
    accounts: {},
  };
  await writeJsonAtomic(path, data);
}

export async function loadSequence(path: string): Promise<SequenceData> {
  const file = Bun.file(path);
  return (await file.json()) as SequenceData;
}

export function getNextAccountNumber(seq: SequenceData): number {
  const keys = Object.keys(seq.accounts).map(Number);
  if (keys.length === 0) return 1;
  return Math.max(...keys) + 1;
}

export function accountExists(seq: SequenceData, email: string): boolean {
  return Object.values(seq.accounts).some((a) => a.email === email);
}

export function addAccountToSequence(
  seq: SequenceData,
  info: { email: string; uuid: string; alias?: string }
): SequenceData {
  const num = getNextAccountNumber(seq);
  const numStr = String(num);
  const account: Account = {
    email: info.email,
    uuid: info.uuid,
    added: new Date().toISOString(),
  };
  if (info.alias) {
    account.alias = info.alias;
  }
  return {
    ...seq,
    accounts: { ...seq.accounts, [numStr]: account },
    sequence: [...seq.sequence, num],
    activeAccountNumber: num,
    lastUpdated: new Date().toISOString(),
  };
}

export function removeAccountFromSequence(
  seq: SequenceData,
  accountNum: string
): SequenceData {
  const numValue = Number(accountNum);
  const { [accountNum]: _, ...remainingAccounts } = seq.accounts;
  return {
    ...seq,
    accounts: remainingAccounts,
    sequence: seq.sequence.filter((n) => n !== numValue),
    lastUpdated: new Date().toISOString(),
  };
}

export function getNextInSequence(seq: SequenceData): number {
  const currentIndex = seq.sequence.indexOf(seq.activeAccountNumber!);
  const nextIndex = (currentIndex + 1) % seq.sequence.length;
  return seq.sequence[nextIndex];
}

export function resolveAccountIdentifier(
  seq: SequenceData,
  identifier: string
): string | null {
  // Check if it's a number
  if (/^\d+$/.test(identifier)) {
    return seq.accounts[identifier] ? identifier : null;
  }

  // Search by email
  for (const [num, account] of Object.entries(seq.accounts)) {
    if (account.email === identifier) return num;
  }

  return null;
}

export function setAlias(
  seq: SequenceData,
  accountNum: string,
  alias: string
): SequenceData {
  // Check for duplicate alias
  for (const [num, account] of Object.entries(seq.accounts)) {
    if (num !== accountNum && account.alias === alias) {
      throw new Error(
        `Alias "${alias}" is already in use by account ${num} (${account.email})`
      );
    }
  }

  const account = seq.accounts[accountNum];
  if (!account) {
    throw new Error(`Account ${accountNum} does not exist`);
  }

  return {
    ...seq,
    accounts: {
      ...seq.accounts,
      [accountNum]: { ...account, alias },
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function findAccountByAlias(
  seq: SequenceData,
  alias: string
): string | null {
  for (const [num, account] of Object.entries(seq.accounts)) {
    if (account.alias === alias) return num;
  }
  return null;
}
