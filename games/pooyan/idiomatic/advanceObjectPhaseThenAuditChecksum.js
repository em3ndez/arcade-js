// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { FRAME_COUNTER, TAMPER_NIBBLE_SUM_BLOCK, TAMPER_STRIKES_SIG } from "./names.js";
/**
 * advanceObjectPhaseThenAuditChecksum — ROM 0x4103-0x4136. [seen]
 *
 * WHAT IT IS
 *   A per-object frame-advance step. An object (a pooya, the eagle, a diving or rising
 *   enemy) is described by a 24-byte record; `rec` points at that record's base. Every
 *   frame the object's owning state handler calls this routine to push the object's
 *   animation and phase forward by one tick.
 *
 * ROLE IN THE MACHINE
 *   Two jobs are welded together here. The first is ordinary bookkeeping: run the shared
 *   animation sequencer, then tick a per-object dwell timer and, when it lapses, step the
 *   object into its next phase. The second is a piece of the anti-tamper lattice that
 *   defends the program image. Once per full frame-counter cycle this routine folds a
 *   fixed block of program bytes into a small checksum and, if the result is not the
 *   value only an unmodified board can produce, bumps a strike counter. The failure arm
 *   is deliberately quiet: it never halts, it just records a miss that other guards and
 *   handlers can later read as "this board has been altered." On an intact board the
 *   checksum always matches, so the strike is never taken during normal play — it is a
 *   tripwire, not a routine event.
 *
 * GROUNDING: [seen] (per the names.js cert for 0x4103). The fixed program block it folds,
 *   TAMPER_NIBBLE_SUM_BLOCK, is tagged [code].
 *
 * LIVE-OUT: memory only. Everything it changes lives in the object record (its dwell,
 *   phase, and a cleared field) and, on a tamper miss, the signature strike counter
 *   TAMPER_STRIKES_SIG. It returns nothing.
 */

// Object-record field offsets (relative to the record base `rec`).
const DWELL_FIELD = 0x11; //   frame dwell countdown: frames left to hold the current phase
const PHASE_FIELD = 0x02; //   animation/phase index, bumped when the dwell lapses
const RESET_FIELD = 0x13; //   scratch/sub-state field, cleared on each phase advance

// Anti-tamper checksum shape. The block is BLOCK_LEN bytes of fixed program memory; an
// intact image folds the low nibbles to a running low byte of CHECKSUM_LOW_OK with exactly
// one carry out of the 8-bit total.
const BLOCK_LEN = 0x38; //     count of program bytes folded into the checksum
const CHECKSUM_LOW_OK = 0x67; // intact low-total; the carry count must also be exactly 1

export function advanceObjectPhaseThenAuditChecksum(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — advance the object's picture. The shared per-object animation sequencer
  // (ROM 0x4006) counts down the record's frame-hold and, when it expires, pulls the next
  // tile/attribute/hold from the object's animation script. Purely a per-frame animation
  // tick; the phase logic below is independent of it.
  advanceObjectAnimationFrame(m, rec);

  // Step 2 — tick the phase dwell timer (record field +0x11). This counts how many more
  // frames the object should stay in its current phase. Decrement it modulo 256 and store
  // it back. While it is still non-zero the object holds its phase, so nothing further
  // happens this frame and the routine returns.
  const dwell = (mem8[rec + DWELL_FIELD] - 1) & 0xff;
  mem8[rec + DWELL_FIELD] = dwell;
  if (dwell !== 0) return; // still dwelling on the current frame

  // Step 3 — the dwell lapsed, so advance the object one phase. Bump the phase index at
  // field +0x02 (its owning handler uses this to select the next animation/behaviour) and
  // clear the scratch field +0x13 that the new phase starts from.
  mem8[rec + PHASE_FIELD] = (mem8[rec + PHASE_FIELD] + 1);
  mem8[rec + RESET_FIELD] = 0x00;

  // Step 4 — gate the integrity check on the free-running frame counter (0x8a5f), which
  // the vblank interrupt decrements every frame. The anti-tamper fold below is expensive,
  // so it is run only on the one frame in the counter's cycle where it reads zero; on every
  // other frame this routine is done after advancing the phase.
  if (mem8[FRAME_COUNTER] !== 0) return; // checksum runs only on the zero crossing

  // Step 5 — fold the fixed program block into the anti-tamper checksum. Walk BLOCK_LEN
  // bytes starting at TAMPER_NIBBLE_SUM_BLOCK (ROM 0x557f), adding each byte's low nibble
  // into an 8-bit running total `low` and counting how many times that total carries out of
  // eight bits into `carries`. This mirrors the Z80's DE accumulator: E is the running low
  // byte, D counts the carries.
  let low = 0;
  let carries = 0;
  for (let i = 0; i < BLOCK_LEN; i++) {
    const total = low + (mem8[TAMPER_NIBBLE_SUM_BLOCK + i] & 0x0f);
    low = total & 0xff;
    if (total > 0xff) carries = (carries + 1) & 0xff;
  }

  // Step 6 — compare against the sentinel only an unmodified block can produce: the running
  // low byte must equal CHECKSUM_LOW_OK (0x67) and there must have been exactly one carry.
  // If both hold the block is intact and the routine returns with no side effect. Any
  // deviation means the program image has been altered, so bump the signature strike
  // counter TAMPER_STRIKES_SIG (0x8a38) — a silent record of the miss that downstream tamper
  // logic can act on.
  const intact = low === CHECKSUM_LOW_OK && carries === 1;
  if (!intact) mem8[TAMPER_STRIKES_SIG] = (mem8[TAMPER_STRIKES_SIG] + 1);
}
