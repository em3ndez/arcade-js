// SPDX-License-Identifier: GPL-3.0-only
/** spawnEnemyCraftWhenBandUnderTwo — gate a spawning tick on the packed-decimal phase byte the caller points at, count the
 * busy heads across the enemy-craft band, and only when fewer than two are busy run the free-slot
 * search: the cleared run when the owed-kills cell is zero, else the owed run seated for as many
 * turns as the round asks. LIVE-OUT: memory. The count and the two cursors go to the search as
 * arguments, and the sole caller (driveEnemyWaveForLifePhase) tail-returns this result. */

import { u16 } from "../../../core/int.js";
import { loc_3793 } from "./loc_3793.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";
import { CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT0, CRAFT_RECORD_SLOT6, KILLS_REMAINING, ROUND_CRAFT_COUNT } from "./names.js";

const RECORD_STRIDE = 0x10;
const BAND_SLOTS = 0x07;
const BUSY_CEILING = 0x02;
const OPEN_PHASE = 0x30;

export function spawnEnemyCraftWhenBandUnderTwo(m, hl = m.regs.hl) {
  const { mem8 } = m;

  // run only when the phase byte the caller points at is idle or at OPEN_PHASE
  const phase = mem8[hl];
  if (phase !== 0x00 && phase !== OPEN_PHASE) return;

  // count busy heads across the seven-record craft band (max 7, so the count never wraps)
  let busy = 0;
  let ptr = CRAFT_RECORD_SLOT0;
  for (let n = BAND_SLOTS; n > 0; n--) {
    if (mem8[ptr] !== 0x00) busy += 1;
    ptr = u16(ptr + RECORD_STRIDE);
  }
  if (busy >= BUSY_CEILING) return; // two or more slots already busy

  // nothing owed -> the cleared five-slot run; else the owed run over the round's craft count
  if (mem8[KILLS_REMAINING] === 0x00) return loc_3793(m);

  // the owed run: the round's craft count of turns, from the slot-6 record and its entry downward
  return spawnEnemyIntoFreeSlotElseStepSearch(m, CRAFT_RECORD_SLOT6, CRAFT_ENTRY_SLOT6, mem8[ROUND_CRAFT_COUNT]);
}
