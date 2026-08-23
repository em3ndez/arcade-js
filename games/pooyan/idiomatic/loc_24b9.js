// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommands95And10 } from "./queueSoundCommands95And10.js";
/**
 * loc_24b9 — actor state-3 handler for a record based at IX (dispatched from the actor state
 * table). Ticks the alternate-frame sub-counter at +0x05 and, only on its even values, decrements
 * the counter at +0x06. Every frame it advances the base Y at +0x04 by two; while that stays below
 * the floor it returns. Once Y reaches the floor it queues the pattern-A sound, reseeds the frame
 * delay at +0x11, and advances the record to its next dispatch state.
 *
 * LIVE-OUT: memory only — the record fields at IX. The state dispatcher reads no register or flag
 * back, so the early-return path's leftover compare flags do not matter.
 */
const FLOOR_Y = 0xdc; // Y value at which the actor reaches the floor and transitions
const FRAME_DELAY_RESEED = 0x02; // reload for the frame delay at +0x11 on transition

export function loc_24b9(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x05] = mem8[rec + 0x05] + 1;
  if ((mem8[rec + 0x05] & 0x01) === 0) {
    mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // decrement only on the even (bit0-clear) frames
  }

  mem8[rec + 0x04] = mem8[rec + 0x04] + 0x02;
  if (mem8[rec + 0x04] < FLOOR_Y) return; // Y still above the floor: nothing more to do

  queueSoundCommands95And10(m); // reached the floor: queue the pattern-A sound
  mem8[rec + 0x11] = FRAME_DELAY_RESEED;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
