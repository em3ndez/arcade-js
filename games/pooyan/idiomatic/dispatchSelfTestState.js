// SPDX-License-Identifier: GPL-3.0-only
import { seedDisplayListPointersAndVerifyRomSignature } from "./seedDisplayListPointersAndVerifyRomSignature.js";
import { runDisplayListAndAdvanceToGameplay } from "./runDisplayListAndAdvanceToGameplay.js";
import { updateGameplayFrame } from "./updateGameplayFrame.js";
import { SELFTEST_DISPATCH_STATE } from "./names.js";
/**
 * dispatchSelfTestState — attract/self-test state dispatcher. Tail-hands the low two bits of the self-test state to
 * one of three handlers (signature check, HUD checksum, per-frame gameplay driver); no continuation is
 * stacked, so the handler returns straight to our caller. The fourth mask value is guard-slack — the
 * three-entry table has no handler for it, so it is never a valid state. LIVE-OUT: memory only.
 */
export function dispatchSelfTestState(m) {
  switch (m.mem8[SELFTEST_DISPATCH_STATE] & 0x03) {
    case 0:
      return seedDisplayListPointersAndVerifyRomSignature(m);
    case 1:
      return runDisplayListAndAdvanceToGameplay(m);
    case 2:
      return updateGameplayFrame(m);
    default:
      throw new Error("dispatchSelfTestState: self-test state 3 has no handler (guard-slack)");
  }
}
