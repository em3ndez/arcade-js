// SPDX-License-Identifier: GPL-3.0-only
import { loc_683a } from "./loc_683a.js";
import { advanceObjectAscentStep } from "./advanceObjectAscentStep.js";
import { loc_68ac } from "./loc_68ac.js";
import { ENEMY_REC_DISPATCH_GATE, ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * loc_6822 — special-object record state dispatcher. Returns when the dispatch gate is zero; otherwise
 * reads the state byte of the record at ENEMY_ACTOR_TABLE+RECORD and tail-hands it to one of three
 * handlers (handler returns to our caller). LIVE-OUT: memory only.
 */
const RECORD = 0x48; // record offset from ENEMY_ACTOR_TABLE

export function loc_6822(m) {
  const { mem8 } = m;
  if (mem8[ENEMY_REC_DISPATCH_GATE] === 0) return; // gate closed
  const rec = ENEMY_ACTOR_TABLE + RECORD;
  switch (mem8[rec + 0x02]) {
    case 0: return loc_683a(m, rec);
    case 1: return advanceObjectAscentStep(m, rec);
    case 2: return loc_68ac(m);
    default:
      throw new Error("loc_6822: record state > 2 (guard-slack; the table has 3 entries)");
  }
}
