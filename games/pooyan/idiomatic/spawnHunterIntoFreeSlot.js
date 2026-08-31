// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_119a } from "./loc_119a.js";
/**
 * spawnHunterIntoFreeSlot — the enemy-spawn slot sweep: walk up to `count` actor records (from `rec`, stride 24)
 * and initialise free ones via the per-record spawn initialiser, seeding each with position field 0x1d.
 *
 * When a free record is seeded the remaining-slot count is reloaded from `activationIndex` (the spawn
 * deficit) before the next step — so the loop length after the first seed is governed by that index
 * rather than the incoming count.
 *
 * LIVE-OUT: memory only — seeded record fields, the spawn timer, and the two spawn counters, all
 * written inside the initialiser. No load-bearing register output (count/rec end as scratch).
 */

const POSITION_SEED = 0x1d;
const RECORD_STRIDE = 24;

export function spawnHunterIntoFreeSlot(m, count = m.regs.b, rec = m.regs.ix, activationIndex = m.regs.c) {
  let remaining = count & 0xff;
  let record = u16(rec);
  do {
    const alreadyActive = loc_119a(m, record, POSITION_SEED);
    if (!alreadyActive) remaining = activationIndex & 0xff; // on the seed path, count comes from the activation index
    record = u16(record + RECORD_STRIDE);
    remaining = (remaining - 1) & 0xff; // djnz
  } while (remaining !== 0);
}
