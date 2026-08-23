// SPDX-License-Identifier: GPL-3.0-only
import { loc_5e98 } from "./loc_5e98.js";
import { u16 } from "../../../core/int.js";
import { ROUND_COUNTER, SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";

const PASSES = 2; // the sweep runs the actor-record table twice
const SLOT_STRIDE = 4; // one record between passes

/**
 * loc_5e78 — gated actor-sweep driver.
 *
 * On an odd round only, hands the actor-record table to the per-slot sweep twice: a phase latch of
 * 0 on the first pass and 1 after, with the table pointer advanced one record between passes.
 *
 * LIVE-OUT: none — a void per-frame driver; the caller reads nothing back. The phase latch and
 * target box are seated in the register bridge the per-slot sweep's recursive scan reads back.
 */
export function loc_5e78(m) {
  const { mem8, regs } = m;
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // even round -> disabled
  let table = SPRITE_ACTOR_RECORD_SLOTS;
  for (let pass = 0; pass < PASSES; pass++) {
    regs.iy = table; // target box the recursive scan reads
    regs.i = pass === 0 ? 0 : 1; // phase latch the recursive scan reads
    loc_5e98(m);
    table = u16(table + SLOT_STRIDE);
  }
}
