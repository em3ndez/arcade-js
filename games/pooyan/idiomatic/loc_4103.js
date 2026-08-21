// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { FRAME_COUNTER, TAMPER_NIBBLE_SUM_BLOCK, TAMPER_STRIKES_SIG } from "./names.js";
/**
 * loc_4103 — per-object frame-advance step for the record based at IX.
 *
 * First it advances the object's animation. Field +0x11 is a dwell countdown: while it
 * stays non-zero the object holds and the routine returns. On expiry it bumps the phase
 * field +0x02 and clears field +0x13, and — only on the frame-counter zero crossing — folds
 * the low nibbles of a fixed program block into a checksum (an 8-bit running total plus a
 * carry count). A matching total is intact and returns; any deviation bumps the signature
 * tamper counter.
 *
 * LIVE-OUT: memory only — all state persists in the record and the tamper counter.
 */

const DWELL_FIELD = 0x11; //   frame dwell countdown
const PHASE_FIELD = 0x02; //   animation/phase index
const RESET_FIELD = 0x13; //   cleared on each phase advance
const BLOCK_LEN = 0x38; //     bytes folded into the checksum
const CHECKSUM_LOW_OK = 0x67; // intact low-total; carry count must also be 1

export function loc_4103(m, rec = m.regs.ix) {
  const { mem8 } = m;
  loc_4006(m, rec);

  const dwell = (mem8[rec + DWELL_FIELD] - 1) & 0xff;
  mem8[rec + DWELL_FIELD] = dwell;
  if (dwell !== 0) return; // still dwelling on the current frame

  mem8[rec + PHASE_FIELD] = (mem8[rec + PHASE_FIELD] + 1);
  mem8[rec + RESET_FIELD] = 0x00;
  if (mem8[FRAME_COUNTER] !== 0) return; // checksum runs only on the zero crossing

  let low = 0;
  let carries = 0;
  for (let i = 0; i < BLOCK_LEN; i++) {
    const total = low + (mem8[TAMPER_NIBBLE_SUM_BLOCK + i] & 0x0f);
    low = total & 0xff;
    if (total > 0xff) carries = (carries + 1) & 0xff;
  }
  const intact = low === CHECKSUM_LOW_OK && carries === 1;
  if (!intact) mem8[TAMPER_STRIKES_SIG] = (mem8[TAMPER_STRIKES_SIG] + 1);
}
