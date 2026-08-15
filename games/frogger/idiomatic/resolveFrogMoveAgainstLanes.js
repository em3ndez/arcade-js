// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveFrogMoveAgainstLanes — resolve a horizontal frog move against the object lanes (upper half of the dispatcher).
 * Returns at once when the move is already resolved. Otherwise the frog X picks one of sixteen arms
 * through a pointer table: five scan no lane, ten seed a lane object list + band width. An object in
 * the frog's move band blocks the move; a clear lane kills the frog when it has not yet crossed.
 * LIVE-OUT: memory-only (the move-blocked flag, plus the kill tail's own cells).
 */
import {
  loc_8004, loc_8047, loc_802f, loc_8044, loc_130b,
  loc_8100, loc_8109, loc_8112, loc_811b, loc_8124, loc_8136, loc_813f, loc_8148, loc_8151, loc_815a,
} from "./names.js";

const KILL_TAIL = 0x12d0; // frog-kill tail: raises the blocked flag and, mid-band, the kill cell

// arm value (from the pointer table) -> [lane object-list base, band width]; others scan no lane.
const LANES = new Map([
  [0x1334, [loc_8100, 60]],
  [0x133c, [loc_8109, 31]],
  [0x1344, [loc_8112, 92]],
  [0x134c, [loc_811b, 44]],
  [0x1354, [loc_8124, 47]],
  [0x1364, [loc_8136, 34]],
  [0x136c, [loc_813f, 18]],
  [0x1374, [loc_8148, 18]],
  [0x137c, [loc_8151, 18]],
  [0x1384, [loc_815a, 18]],
]);

export function resolveFrogMoveAgainstLanes(m) {
  const { mem8, mem16 } = m;
  if (mem8[loc_8004] !== 0) return; // the move is already resolved this frame

  const key = (mem8[loc_8047] + 15) & 0xff;
  if ((key & 0x0f) < 5) return; // low nibble < 5 -> the no-lane arm 0
  const arm = mem16[(loc_130b + 2 * ((key & 0xf0) >> 4)) & 0xffff];
  const lane = LANES.get(arm);
  if (!lane) return;

  return scanLane(m, lane[0], lane[1]);
}

function scanLane(m, laneBase, width) {
  const { mem8 } = m;
  const offset = mem8[loc_802f] < 128 ? 12 : 3;
  const low = (mem8[loc_8044] + offset) & 0xff;
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
      if (mem8[loc_8047] < 128) return; // frog not across -> nothing blocks
      mem8[loc_8004] = 1;
      return;
    }
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    if (mem8[loc_8047] < 128) return m.call(KILL_TAIL); // lane clear, frog not across -> kill
    return;
  }
}
