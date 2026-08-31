// SPDX-License-Identifier: GPL-3.0-only

// The three state handlers this dispatcher branches into. Each is a complete
// self-test / attract-mode phase in its own right; this file only chooses which
// one runs on the current tick, based on a single selector byte in work RAM.
import { seedDisplayListPointersAndVerifyRomSignature } from "./seedDisplayListPointersAndVerifyRomSignature.js";
import { runDisplayListAndAdvanceToGameplay } from "./runDisplayListAndAdvanceToGameplay.js";
import { updateGameplayFrame } from "./updateGameplayFrame.js";
// SELFTEST_DISPATCH_STATE is 0x8921, the one-byte attract/self-test state selector.
import { SELFTEST_DISPATCH_STATE } from "./names.js";

/**
 * dispatchSelfTestState — attract/self-test state dispatcher.
 *
 * WHAT IT IS
 *   The tiny router that sits at the head of the machine's attract / power-on
 *   self-test path. Between the moment the boot routine finishes wiring up work
 *   RAM and the moment a coin drops and real play begins, the machine cycles
 *   through a short sequence of self-test-and-attract phases. Which phase runs
 *   on any given tick is held in a single selector byte; this routine reads that
 *   byte and hands control to the matching phase handler.
 *
 * ROLE IN THE MACHINE
 *   It is a pure branch — a three-way fork keyed on the low two bits of the
 *   selector at SELFTEST_DISPATCH_STATE (0x8921). The three phases form a small
 *   progression that the machine walks in order:
 *     state 0  seedDisplayListPointersAndVerifyRomSignature (ROM 0x744e)
 *              arms the attract display-list pointer pairs and runs the two-stage
 *              program-signature (anti-tamper) check.
 *     state 1  runDisplayListAndAdvanceToGameplay (ROM 0x7517)
 *              paints attract runs through the display-list interpreter, checksums
 *              two HUD video-RAM strips as an integrity guard, and — on a clean
 *              pass — advances the selector to state 2.
 *     state 2  updateGameplayFrame (ROM 0x755d)
 *              the per-frame gameplay driver.
 *   The selector is advanced by the handlers themselves (state 1 is what steps it
 *   to state 2), never by this dispatcher, so the fork is stateless: it only
 *   reads the selector, it never writes it.
 *
 *   The selected handler returns straight through to this dispatcher's own caller
 *   — a tail dispatch. The machine looks up the handler and jumps to it without
 *   leaving a return of its own on the stack, so control does not come back here
 *   after the branch is taken; whatever the handler leaves behind is the whole
 *   result of the tick.
 *
 * ROM ADDRESS
 *   0x7442-0x7447. The three handler addresses live in an inline word table
 *   immediately after it at 0x7448 (entries 0x744e / 0x7517 / 0x755d).
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. This routine itself leaves nothing in registers or new
 * memory; every observable effect is produced inside the phase handler it calls.
 */
export function dispatchSelfTestState(m) {
  // Read the self-test selector at SELFTEST_DISPATCH_STATE (0x8921) and keep only
  // its low two bits. Masking to 0..3 is the ROM's own bound on the state space:
  // it turns the raw byte into a table index for the three-entry handler table at
  // 0x7448, which is why only values 0, 1 and 2 can ever select a real handler.
  switch (m.mem8[SELFTEST_DISPATCH_STATE] & 0x03) {
    // State 0 — cold entry to the self-test cycle: seed the attract display-list
    // pointer pairs and run the program-signature integrity check (ROM 0x744e).
    case 0:
      return seedDisplayListPointersAndVerifyRomSignature(m);
    // State 1 — drive the attract display and, on a clean HUD-strip checksum,
    // step the selector onward to state 2 (ROM 0x7517).
    case 1:
      return runDisplayListAndAdvanceToGameplay(m);
    // State 2 — the per-frame gameplay driver reached once the machine has walked
    // through the earlier self-test phases (ROM 0x755d).
    case 2:
      return updateGameplayFrame(m);
    // State 3 is guard-slack: the mask can yield 3, but the handler table at
    // 0x7448 has only three entries, so 3 indexes past the end and is never a
    // valid state. Reaching here means the selector byte was left in an impossible
    // value, which is a hard fault rather than a benign case to fall through.
    default:
      throw new Error("dispatchSelfTestState: self-test state 3 has no handler (guard-slack)");
  }
}
