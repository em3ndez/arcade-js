// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorDescentStepAndLand } from "./advanceActorDescentStepAndLand.js";
import { STATE4_SIGCHECK_CODE_BASE_ADDR, STATE5_SIGCHECK_REF_TOP } from "./names.js";
/**
 * verifySignatureThenClearFlipAndAdvance — WHAT IT IS: the state-4 handler of the lead actor's
 * secondary state machine. That state machine keeps its per-actor working data in the record based at
 * IX (here the actor at 0x8a80). One byte of the record, the state field (IX+0x02), selects which of
 * eight handlers runs; this routine is the one selected when the low three bits of that field equal 4.
 *
 * ROLE IN THE MACHINE: the per-frame driver decrements the record's frame-hold counter every frame and
 * only reaches a state handler once that counter runs out, so a handler runs once per "hold" window
 * rather than once per frame. When state 4 comes due this routine does two jobs: (1) it runs a
 * program-integrity self-check, and (2) on a clean check it arms the next hold window, tidies the
 * record's flag byte, and steps the record on to state 5. The self-check is an anti-tamper trap: it
 * proves a fixed span of program code still holds its original bytes before the actor is allowed to
 * proceed. On a genuine, unmodified image the bytes always match, so the trap is invisible during
 * normal play; only an altered image trips it.
 *
 * ROM ADDRESS: 0x2a79 (0x2a79-0x2a95). Reached as entry 4 of the inline dispatch table at 0x28f1.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: three writes into the actor record — frame-hold (IX+0x11) reseeded, the flip bit of the
 * flag byte (IX+0x10) cleared, and the state field (IX+0x02) incremented. There is no register/return
 * live-out on the success path; the routine exists for those record writes. The mismatch branch instead
 * forwards advanceActorDescentStepAndLand's result, but that branch is unreachable on an intact image
 * because both compared spans are fixed program bytes nothing in the record can alter.
 */

// Actor-record field offsets, relative to the record base (IX). The frame-hold counter paces the state
// machine (the driver counts it down before each state runs); the flag byte carries per-actor render
// bits including the flip bit at bit 7; the state field selects the active handler.
const HOLD_FIELD = 0x11;
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
// Value written into the frame-hold field to arm the next hold window (0x30 driver ticks).
const FRAME_HOLD_RESEED = 0x30;
// Bit 7 of the flag byte — the sprite flip bit, cleared as state 4 completes.
const FLIP_BIT = 0x80;
// Length of the self-check, in bytes: 0x68 (104) consecutive bytes are compared.
const SIGCHECK_LEN = 0x68;

export function verifySignatureThenClearFlipAndAdvance(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Program-integrity self-check -----------------------------------------------------------------
  // Compare two fixed spans of program memory byte for byte: a live program window read ascending from
  // STATE4_SIGCHECK_CODE_BASE_ADDR (0x1c66) against a stored reference block read ascending from
  // STATE5_SIGCHECK_REF_TOP (0x2b23). Both walk upward in lock-step for SIGCHECK_LEN bytes. If every
  // byte agrees, the image is intact and the routine falls through to complete state 4.
  let code = STATE4_SIGCHECK_CODE_BASE_ADDR; // program window at 0x1c66, read upward
  let ref = STATE5_SIGCHECK_REF_TOP;         // reference block at 0x2b23, read upward
  let count = SIGCHECK_LEN;
  for (;;) {
    // A single mismatch means the checked code no longer matches its reference: the trap fires and hands
    // control to the descent state handler (dispatch slot 1) without completing state 4 — the record is
    // never advanced and its flag/hold are left untouched. Since both spans are immutable program bytes,
    // this branch cannot be taken on a genuine image.
    if (mem8[ref] !== mem8[code]) return advanceActorDescentStepAndLand(m, rec); // tamper -> state-1 handler
    // Step both cursors upward and count the byte down; keep comparing until all SIGCHECK_LEN bytes pass.
    code = u16(code + 1);
    ref = u16(ref + 1);
    if (--count !== 0) continue;
    break;
  }

  // --- State-4 completion (self-check passed) -------------------------------------------------------
  // Arm the next hold window so the driver waits FRAME_HOLD_RESEED (0x30) ticks before running the actor
  // again.
  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;
  // Clear the sprite flip bit (bit 7 of the flag byte), resetting the actor's mirrored-render state as
  // this phase ends.
  mem8[rec + FLAG_FIELD] &= ~FLIP_BIT;                    // clear the flip bit
  // Advance the state field so the next time this actor comes due the driver dispatches state 5 (whose
  // own signature check continues the integrity chain).
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;  // advance the state byte
}
