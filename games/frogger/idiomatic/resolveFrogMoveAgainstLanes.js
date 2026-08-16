// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveFrogMoveAgainstLanes — resolve a horizontal frog move against the object lanes (upper half of the dispatcher).
 * Returns at once when the move is already resolved. Otherwise the frog's row (Y) picks one of sixteen
 * arms through a pointer table: five scan no lane, ten seed a lane object list + band width. An object
 * in the frog's move band (scanned against the frog X) blocks the move; a clear lane kills the frog
 * when it has not yet crossed.
 * LIVE-OUT: memory-only (the move-blocked flag, plus the kill tail's own cells).
 */
import {
  HOLD_FLAG, FROG_Y, LANE_LOW_BOUND_SELECTOR, FROG_X, LANE_SCAN_ARM_TABLE,
  SPRITE_BLOCK2_BASE, LANE_OBJLIST_8109, LANE_OBJLIST_8112, LANE_OBJLIST_811B, LANE_OBJLIST_8124, LANE_OBJLIST_8136, LANE_OBJLIST_813F, LANE_OBJLIST_8148, LANE_OBJLIST_8151, LANE_OBJLIST_815A,
} from "./names.js";

import { killFrogAtLane } from "./dispatchFrogMoveAgainstLanes.js";

// arm value (from the pointer table) -> [lane object-list base, band width]; others scan no lane.
const LANES = new Map([
  [0x1334, [SPRITE_BLOCK2_BASE, 60]],
  [0x133c, [LANE_OBJLIST_8109, 31]],
  [0x1344, [LANE_OBJLIST_8112, 92]],
  [0x134c, [LANE_OBJLIST_811B, 44]],
  [0x1354, [LANE_OBJLIST_8124, 47]],
  [0x1364, [LANE_OBJLIST_8136, 34]],
  [0x136c, [LANE_OBJLIST_813F, 18]],
  [0x1374, [LANE_OBJLIST_8148, 18]],
  [0x137c, [LANE_OBJLIST_8151, 18]],
  [0x1384, [LANE_OBJLIST_815A, 18]],
]);

export function resolveFrogMoveAgainstLanes(m) {
  const { mem8, mem16 } = m;
  if (mem8[HOLD_FLAG] !== 0) return; // the move is already resolved this frame

  const key = (mem8[FROG_Y] + 15) & 0xff;
  if ((key & 0x0f) < 5) return; // low nibble < 5 -> the no-lane arm 0
  const arm = mem16[(LANE_SCAN_ARM_TABLE + 2 * ((key & 0xf0) >> 4)) & 0xffff];
  const lane = LANES.get(arm);
  if (!lane) return;

  return scanLane(m, lane[0], lane[1]);
}

function scanLane(m, laneBase, width) {
  const { mem8 } = m;
  const offset = mem8[LANE_LOW_BOUND_SELECTOR] < 128 ? 12 : 3;
  const low = (mem8[FROG_X] + offset) & 0xff;
  const highRaw = low + width;
  const wrapped = highRaw > 0xff;
  const top = highRaw & 0xff;

  let remaining = mem8[laneBase] || 256; // object count; 0 scans the full 256
  let p = laneBase;
  for (;;) {
    p = (p + 1) & 0xffff;
    const objX = mem8[p];
    const inBand = wrapped ? objX >= low || objX < top : objX >= low && objX < top;
    if (inBand) {
      if (mem8[FROG_Y] < 128) return; // frog not across -> nothing blocks
      mem8[HOLD_FLAG] = 1;
      return;
    }
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    if (mem8[FROG_Y] < 128) return killFrogAtLane(m); // lane clear, frog not across -> kill
    return;
  }
}
