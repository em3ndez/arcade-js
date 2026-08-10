// SPDX-License-Identifier: GPL-3.0-only
/** loc_4f5d — set up one sweep of shots against targets and run it. Everything is fixed here, nothing read to
 * decide it: which shot run, which target run in both parallel tables, the counts, and the two box-size numbers.
 * Two choices are also written into the cell pair the sweep reloads between passes, so the target run restarts for
 * every shot; the target count is staged twice (first pass and the rest) at the same value. LIVE-OUT: memory, plus
 * the staged registers the sweep consumes. */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { PLAYER_SHOT_ARRAY } from "./names.js";

const TARGET_RECORDS = 0xa8c0;
const TARGET_ENTRIES = 0xaa28;
const TARGETS = 3;
const SHOTS = 6;
const REACH = 7;
const SPAN = 15;

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;

export function loc_4f5d(m) {
  const { mem16, regs } = m;
  regs.de = TARGET_RECORDS;
  regs.iy = TARGET_ENTRIES;
  regs.ix = PLAYER_SHOT_ARRAY;
  regs.a_ = TARGETS;
  regs.b = TARGETS;
  regs.c = SHOTS;
  mem16[TARGET_RECORD_CURSOR] = TARGET_RECORDS;
  mem16[TARGET_ENTRY_CURSOR] = TARGET_ENTRIES;
  regs.l = REACH;
  regs.h = SPAN;
  destroyTargetsHitByShots(m);
}
