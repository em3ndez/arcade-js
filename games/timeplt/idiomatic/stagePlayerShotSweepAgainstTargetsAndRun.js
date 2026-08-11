// SPDX-License-Identifier: GPL-3.0-only
/** stagePlayerShotSweepAgainstTargetsAndRun — set up one sweep of shots against targets and run it. Everything is fixed here, nothing read to
 * decide it: which shot run, which target run in both parallel tables, the counts, and the two box-size numbers.
 * Two choices are also written into the cell pair the sweep reloads between passes, so the target run restarts for
 * every shot; the target count is staged twice (first pass and the rest) at the same value. LIVE-OUT: memory, plus
 * the staged registers the sweep consumes. */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, PLAYER_SHOT_ARRAY, SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";

const TARGETS = 3;
const SHOTS = 6;
const REACH = 7;
const SPAN = 15;


export function stagePlayerShotSweepAgainstTargetsAndRun(m) {
  const { mem16, regs } = m;
  regs.de = ERA_OBJECT_RECORD_SLOT0;
  regs.iy = ERA_OBJECT_ENTRY_SLOT0;
  regs.ix = PLAYER_SHOT_ARRAY;
  regs.a_ = TARGETS;
  regs.b = TARGETS;
  regs.c = SHOTS;
  mem16[SCRATCH_PTR_B] = ERA_OBJECT_RECORD_SLOT0;
  mem16[SCRATCH_PTR_A] = ERA_OBJECT_ENTRY_SLOT0;
  regs.l = REACH;
  regs.h = SPAN;
  destroyTargetsHitByShots(m);
}
