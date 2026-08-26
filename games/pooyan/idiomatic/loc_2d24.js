// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
/**
 * loc_2d24 — hunter dispatch state 2 (dissolved caller-skip). Steps the record's animation, then
 * advances its 16-bit vertical position (+0x05 low / +0x06 high) by the per-frame step (+0x09). While
 * the high byte stays below 0x19 it returns true (keep going). Once it reaches 0x19 it advances the
 * record's state (+0x02), clears the position and script fields (+0x05/+0x06/+0x16), and returns false
 * — a caller-skip boolean aborting the hunter walk. LIVE-OUT: the boolean; every other effect is memory.
 */
const POS_LO = 0x05;
const POS_HI = 0x06;
const POS_STEP = 0x09;
const STATE = 0x02;
const SCRIPT = 0x16;
const TOP_ROW = 0x19;

export function loc_2d24(m, rec = m.regs.ix) {
  const { mem8 } = m;
  advanceObjectAnimationFrame(m, rec); // pattern A: step the animation frame
  const low = mem8[rec + POS_LO] + mem8[rec + POS_STEP];
  if (low > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  mem8[rec + POS_LO] = low;
  if (mem8[rec + POS_HI] < TOP_ROW) return true; // still climbing
  mem8[rec + STATE] = mem8[rec + STATE] + 1; // reached top: advance the record state
  mem8[rec + POS_LO] = 0;
  mem8[rec + POS_HI] = 0;
  mem8[rec + SCRIPT] = 0;
  return false; // caller-skip
}
