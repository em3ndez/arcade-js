// SPDX-License-Identifier: GPL-3.0-only
import { loc_250f } from "./loc_250f.js";
import { TAMPER_STRIKES_STATE10, SHAPE_TABLE_26C1 } from "./names.js";
/**
 * dropLeadActorAfterDelay — actor state-1 step for the record based at IX. Counts down the frame delay (IX+0x11);
 * while it has not reached zero, return. On expiry, if the state-10 tamper counter is clear it
 * reseeds the delay and advances the actor state (IX+0x02); otherwise (the anti-tamper overlap arm,
 * unreached in normal play) it stores that tamper value at (BC). Both arms then bump the base Y
 * (IX+0x04), clear (IX+0x1e), and load the shape table via the pattern-A shape loader.
 *
 * LIVE-OUT (expiry path, inherited from the shape loader): IX past the copied run, B = 0, HL = the
 * board-clear flag, A = 0. The early frame-delay return leaves the registers untouched.
 */
const DELAY_RESEED = 0x10; // frame delay reloaded once it expires
const BASE_Y_STEP = 0x10; //  amount the base Y (IX+0x04) advances each expiry

export function dropLeadActorAfterDelay(m, rec = m.regs.ix, bc = m.regs.bc) {
  const { mem8 } = m;

  mem8[rec + 0x11] = (mem8[rec + 0x11] - 1);
  if (mem8[rec + 0x11] !== 0) return; // frame delay not yet expired

  const tamper = mem8[TAMPER_STRIKES_STATE10];
  if (tamper !== 0) {
    mem8[bc] = tamper; // anti-tamper overlap arm
  } else {
    mem8[rec + 0x11] = DELAY_RESEED;
    mem8[rec + 0x02] = (mem8[rec + 0x02] + 1); // advance the actor state
  }

  mem8[rec + 0x04] = (mem8[rec + 0x04] + BASE_Y_STEP);
  mem8[rec + 0x1e] = 0;
  return loc_250f(m, SHAPE_TABLE_26C1, rec);
}
