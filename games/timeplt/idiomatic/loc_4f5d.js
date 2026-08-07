// SPDX-License-Identifier: GPL-3.0-only
/** loc_4f5d — set up one sweep of shots against targets and run it. Everything the sweep needs is
 * fixed here and nothing is read to decide any of it: which run of shots, which run of targets in
 * both of the parallel tables they are kept in, how many of each, and the two numbers that size
 * the box a hit has to fall inside. Two of those choices are also written into a pair of cells the
 * sweep reloads between passes, so the target run restarts for every shot rather than being
 * consumed by the first. The count of targets is staged twice over, once for the first pass and
 * once for the passes after it, at the same value. LIVE-OUT: memory, plus the staged registers,
 * which the sweep consumes and which outlive it. */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";

const TARGET_RECORDS = 0xa8c0;
const TARGET_ENTRIES = 0xaa28;
const SHOT_RECORDS = 0xaa80;
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
  regs.ix = SHOT_RECORDS;
  regs.a_ = TARGETS;
  regs.b = TARGETS;
  regs.c = SHOTS;
  mem16[TARGET_RECORD_CURSOR] = TARGET_RECORDS;
  mem16[TARGET_ENTRY_CURSOR] = TARGET_ENTRIES;
  regs.l = REACH;
  regs.h = SPAN;
  destroyTargetsHitByShots(m);
}
