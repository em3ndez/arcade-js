// SPDX-License-Identifier: GPL-3.0-only
/** stagePlayerShotSweepAgainstTargetsAndRun — set up one sweep of shots against targets and run it. Everything is fixed here, nothing read to
 * decide it: which shot run, which target run in both parallel tables, the counts, and the two box-size numbers.
 * Two choices are also written into the cell pair the sweep reloads between passes, so the target run restarts for
 * every shot; the target count is handed over twice (first pass and the rest) at the same value. LIVE-OUT: memory.
 *
 * ROM 0x4F5D-0x4F7D, tail-jumping to 0x5211. Grounding: [seen] (names.js ROUTINES 0x4f5d).
 *
 * ROLE IN THE MACHINE. runAllCollisionSweepsThisFrame calls this first. It pits the player's six
 * shots (PLAYER_SHOT_ARRAY 0xAA80 [seen]) against the three-slot era-object bank -- records from
 * ERA_OBJECT_RECORD_SLOT0 0xA8C0 [seen] at a sixteen-byte stride, sprite entries from
 * ERA_OBJECT_ENTRY_SLOT0 0xAA28 [seen] -- and destroyTargetsHitByShots does all the destroying and
 * scoring. The box is a reach of 7 over a span of 15: a target is hit within 7 either side of a
 * shot on both axes.
 */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, PLAYER_SHOT_ARRAY, SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";

// Three targets per pass, six shots, box reach 7 / span 15 (ROM: A' = B = 3, C = 6, L = 7, H = 0x0F).
const TARGETS = 3;
const SHOTS = 6;
const REACH = 7;
const SPAN = 15;

export function stagePlayerShotSweepAgainstTargetsAndRun(m) {
  const { mem16 } = m;
  // Step 1 -- park the start of the target run in the two scratch pointers (0xA993 and 0xA991).
  // The sweep reloads its target cursors from these before every shot after the first, so each
  // shot is tested against the whole target run again.
  mem16[SCRATCH_PTR_B] = ERA_OBJECT_RECORD_SLOT0;
  mem16[SCRATCH_PTR_A] = ERA_OBJECT_ENTRY_SLOT0;
  // Step 2 -- run the sweep: shots, target entries, target records, the target count for the
  // first pass and for later passes (the same 3; the ROM keeps the second copy in the shadow
  // accumulator), the shot count, then the box's reach and span.
  return destroyTargetsHitByShots(
    m, PLAYER_SHOT_ARRAY, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, TARGETS, TARGETS, SHOTS, REACH, SPAN,
  );
}
