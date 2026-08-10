// SPDX-License-Identifier: GPL-3.0-only
/** loc_379f — gate a spawning tick on the packed-decimal phase byte the caller points at, count the
 * busy heads across the enemy-craft band, and only when fewer than two are busy run the free-slot
 * search: the cleared run when the owed-kills cell is zero, else the owed run seated for as many
 * turns as the round asks. LIVE-OUT: whatever the chosen search leaves, or nothing when the gate is
 * shut or two heads are already busy. */

import { loc_3793 } from "./loc_3793.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";
import { CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT0, CRAFT_RECORD_SLOT6, ROUND_CRAFT_COUNT } from "./names.js";

const RECORD_STRIDE = 0x10;
const BAND_SLOTS = 0x07;
const BUSY_CEILING = 0x02;
const OPEN_PHASE = 0x30;
const OWED_KILLS = 0xad02;

export function loc_379f(m) {
  const { regs, mem8 } = m;

  regs.a = mem8[regs.hl];
  regs.and(regs.a);
  if (regs.a !== 0x00) {
    regs.cp(OPEN_PHASE);
    if (regs.a !== OPEN_PHASE) return; // neither the idle nor the open phase
  }

  regs.hl = CRAFT_RECORD_SLOT0;
  regs.de = RECORD_STRIDE;
  regs.b = BAND_SLOTS;
  regs.c = 0x00;
  do {
    regs.a = mem8[regs.hl];
    regs.and(regs.a);
    if (regs.a !== 0x00) regs.c = regs.inc8(regs.c);
    regs.hl = (regs.hl + regs.de) & 0xffff;
  } while (regs.djnz() !== 0);

  regs.a = regs.c;
  regs.cp(BUSY_CEILING);
  if (regs.a >= BUSY_CEILING) return; // two or more slots already busy

  regs.a = mem8[OWED_KILLS];
  regs.and(regs.a);
  if (regs.a === 0x00) return loc_3793(m);

  regs.a = mem8[ROUND_CRAFT_COUNT];
  regs.b = regs.a;
  regs.ix = CRAFT_RECORD_SLOT6;
  regs.iy = CRAFT_ENTRY_SLOT6;
  return spawnEnemyIntoFreeSlotElseStepSearch(m);
}
