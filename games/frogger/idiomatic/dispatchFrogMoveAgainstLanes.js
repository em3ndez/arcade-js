// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogMoveAgainstLanes — resolve a frog move against the object lanes (lower half of the move dispatcher).
 * Returns at once when the demo/state guard is set or the move is already resolved; otherwise the
 * frog position byte's low nibble (>=9) or high nibble picks one of sixteen arms, six delegating to
 * the upper half and ten scanning a lane object list. In the upper position band an in-band object
 * kills the frog (delegating otherwise); in the lower band a clear lane kills it (delegating otherwise).
 * LIVE-OUT: memory-only (the move-blocked flag, plus the kill tail's own cells).
 */
import {
  loc_83cd, HOLD_FLAG, FROG_Y, FROG_X,
  loc_8100, loc_8109, loc_8112, loc_811b, loc_8124, loc_8136, loc_813f, loc_8148, loc_8151, loc_815a,
} from "./names.js";
import { resolveFrogMoveAgainstLanes } from "./resolveFrogMoveAgainstLanes.js";

const KILL_TAIL = 0x12d0; // frog-kill tail: raises the blocked flag and, mid-band, the kill cell

// frog position high nibble -> [lane object-list base, band width]; the other six nibbles delegate.
const LANE_BY_NIBBLE = new Map([
  [3, [loc_8100, 60]], [4, [loc_8109, 31]], [5, [loc_8112, 92]], [6, [loc_811b, 44]],
  [7, [loc_8124, 47]], [9, [loc_8136, 34]], [10, [loc_813f, 18]], [11, [loc_8148, 18]],
  [12, [loc_8151, 18]], [13, [loc_815a, 18]],
]);

export function dispatchFrogMoveAgainstLanes(m) {
  const { mem8 } = m;
  if (mem8[loc_83cd] !== 0) return;
  if (mem8[HOLD_FLAG] !== 0) return;

  const frogPos = mem8[FROG_Y];
  if ((frogPos & 0x0f) >= 9) return resolveFrogMoveAgainstLanes(m);

  const lane = LANE_BY_NIBBLE.get(frogPos >> 4);
  if (!lane) return resolveFrogMoveAgainstLanes(m);
  return scanLane(m, lane[0], lane[1]);
}

function scanLane(m, laneBase, width) {
  const { mem8 } = m;
  const upperBand = mem8[FROG_Y] >= 128;
  const low = (mem8[FROG_X] + (upperBand ? 3 : 12)) & 0xff;
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
      // object in the band: kill in the upper band, else let the upper half resolve the move
      if (!upperBand) return resolveFrogMoveAgainstLanes(m);
      return m.call(KILL_TAIL);
    }
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    // lane clear: kill in the lower band, else let the upper half resolve the move
    if (!upperBand) return m.call(KILL_TAIL);
    return resolveFrogMoveAgainstLanes(m);
  }
}
