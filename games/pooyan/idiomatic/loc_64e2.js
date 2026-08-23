// SPDX-License-Identifier: GPL-3.0-only
import { loc_6b13 } from "./loc_6b13.js";
import { loc_64fb } from "./loc_64fb.js";
import { loc_66c5 } from "./loc_66c5.js";
import { ENEMY_ACTOR_TABLE, HUNTER_TABLE_BASE } from "./names.js";
/**
 * loc_64e2 — the fountain/spawn subtree driver, run once per frame.
 *
 * Seeds the two-tile fountain blitter, dispatches the fountain record's per-frame state handler,
 * runs the three-record enemy-actor state pass, then the enemy-record state dispatch. Straight-line
 * calls, no branches.
 *
 * SEATING: a void sequencer — no register survives; the caller reads only memory back. The record
 * pointer for the fountain dispatch is handed through the interpreter register it reads.
 */
export function loc_64e2(m) {
  loc_6b13(m);
  m.regs.ix = HUNTER_TABLE_BASE; // fountain record pointer for the state dispatch
  m.push16(m.pc); // seat a scratch return frame for the dispatch tail-return
  loc_64fb(m);
  loc_66c5(m, ENEMY_ACTOR_TABLE);
  return m.call(0x6822); // enemy-record state dispatcher
}
