// ABOUTME: Tests for interactive prompt cancellation handling.
// ABOUTME: Ensures ESC exits map to a clean cancellation flow.

import { describe, expect, test } from "bun:test";
import {
  pickAccount,
  confirmAction,
  PromptCancelledError,
} from "../src/interactive";
import type { SequenceData } from "../src/accounts";

const SEQ: SequenceData = {
  activeAccountNumber: 1,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  sequence: [1],
  accounts: {
    "1": { email: "a@test.com", uuid: "aaa", added: "2026-01-01T00:00:00.000Z" },
  },
};

describe("interactive cancellation", () => {
  test("pickAccount throws PromptCancelledError on ESC", async () => {
    const exitPromptErr = new Error("prompt cancelled");
    exitPromptErr.name = "ExitPromptError";

    const failingSelect = async () => {
      throw exitPromptErr;
    };

    await expect(pickAccount(SEQ, "Switch to account:", failingSelect)).rejects.toBeInstanceOf(
      PromptCancelledError
    );
  });

  test("confirmAction throws PromptCancelledError on ESC", async () => {
    const exitPromptErr = new Error("prompt cancelled");
    exitPromptErr.name = "ExitPromptError";

    const failingConfirm = async () => {
      throw exitPromptErr;
    };

    await expect(confirmAction("Proceed?", failingConfirm)).rejects.toBeInstanceOf(
      PromptCancelledError
    );
  });

  test("pickAccount throws PromptCancelledError on CancelPromptError", async () => {
    const cancelErr = new Error("prompt cancelled");
    cancelErr.name = "CancelPromptError";

    const failingSelect = async () => {
      throw cancelErr;
    };

    await expect(pickAccount(SEQ, "Switch to account:", failingSelect)).rejects.toBeInstanceOf(
      PromptCancelledError
    );
  });

  test("confirmAction throws PromptCancelledError on CancelPromptError", async () => {
    const cancelErr = new Error("prompt cancelled");
    cancelErr.name = "CancelPromptError";

    const failingConfirm = async () => {
      throw cancelErr;
    };

    await expect(confirmAction("Proceed?", failingConfirm)).rejects.toBeInstanceOf(
      PromptCancelledError
    );
  });
});
