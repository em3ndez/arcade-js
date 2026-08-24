// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorToTopRowThenRetire } from "./advanceActorToTopRowThenRetire.js";
import { cycleActorGroupSpriteFramesOnTimer } from "./cycleActorGroupSpriteFramesOnTimer.js";
import { HUNTER_TABLE_BASE } from "./names.js";
/**
 * advanceActorGroupRiseAndCycleTiles — advance then animate the three hunter records.
 *
 * Walks three actor records backward from the incoming pointer (one record, 0x18 bytes, per
 * step), advancing each idle record's position. Then runs the countdown-gated blink animation
 * over the hunter table.
 *
 * LIVE-OUT: memory only — nothing is read back from a register.
 */

const RECORD_COUNT = 3; //     records advanced per pass
const RECORD_STRIDE = -0x18; // one actor record backward per step

export function advanceActorGroupRiseAndCycleTiles(m, ix = m.regs.ix) {
  let record = ix;
  for (let i = 0; i < RECORD_COUNT; i++) {
    advanceActorToTopRowThenRetire(m, record);
    record = u16(record + RECORD_STRIDE);
  }
  cycleActorGroupSpriteFramesOnTimer(m, HUNTER_TABLE_BASE);
}
