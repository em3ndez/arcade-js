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
  FROG_STATE_DEMO_FLAG, HOLD_FLAG, FROG_Y, FROG_X,
  SPRITE_BLOCK2_BASE, LANE_OBJLIST_8109, LANE_OBJLIST_8112, LANE_OBJLIST_811B, LANE_OBJLIST_8124, LANE_OBJLIST_8136, LANE_OBJLIST_813F, LANE_OBJLIST_8148, LANE_OBJLIST_8151, LANE_OBJLIST_815A,
} from "./names.js";
import { resolveFrogMoveAgainstLanes } from "./resolveFrogMoveAgainstLanes.js";

const SECOND_BANK = 0x829c; // second-bank / mid-river kill cell

// killFrogAtLane — the shared frog-kill tail: raise the hold/kill flag, and in the mid-river band
// (0x30 <= Y < 0x80) also set the second-bank kill cell; road band and above-river just flag.
export function killFrogAtLane(m) {
  const { mem8 } = m;
  mem8[HOLD_FLAG] = 1;
  const y = mem8[FROG_Y];
  if (y >= 0x80) return;
  if (y < 0x30) return;
  mem8[SECOND_BANK] = 1;
}

// frog position high nibble -> [lane object-list base, band width]; the other six nibbles delegate.
const LANE_BY_NIBBLE = new Map([
  [3, [SPRITE_BLOCK2_BASE, 60]], [4, [LANE_OBJLIST_8109, 31]], [5, [LANE_OBJLIST_8112, 92]], [6, [LANE_OBJLIST_811B, 44]],
  [7, [LANE_OBJLIST_8124, 47]], [9, [LANE_OBJLIST_8136, 34]], [10, [LANE_OBJLIST_813F, 18]], [11, [LANE_OBJLIST_8148, 18]],
  [12, [LANE_OBJLIST_8151, 18]], [13, [LANE_OBJLIST_815A, 18]],
]);

export function dispatchFrogMoveAgainstLanes(m) {
  const { mem8 } = m;
  if (mem8[FROG_STATE_DEMO_FLAG] !== 0) return;
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
      return killFrogAtLane(m);
    }
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;
    // lane clear: kill in the lower band, else let the upper half resolve the move
    if (!upperBand) return killFrogAtLane(m);
    return resolveFrogMoveAgainstLanes(m);
  }
}
