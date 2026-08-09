// SPDX-License-Identifier: GPL-3.0-only
/** turnShipTowardTargetHeading — turn the ship one notch toward a wanted heading, then scroll the world to match.
 * The wanted heading comes from a fixed table indexed by the value handed in. The live heading in
 * PLAYER_HEADING is left alone when it already matches, snapped on when one notch either side would
 * reach it, and otherwise stepped the short way round the compass by three notches — four once the
 * era's low digit reaches three. Control then falls into the shared world-scroll tail. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { scrollWorldAtTheEraPace } from "./scrollWorldAtTheEraPace.js";
import { PLAYER_HEADING, ERA_INDEX } from "./names.js";

const WANTED_HEADING_TABLE = 0x1f2e;
const FAST_DIGIT = 3;
const FAST_STEP = 4;
const SLOW_STEP = 3;
const WITHIN_ONE_NOTCH = 3;
const HALF_TURN = 128;

export function turnShipTowardTargetHeading(m) {
  const { regs, mem8 } = m;
  regs.hl = WANTED_HEADING_TABLE;
  const wanted = fetchTableByte(m);
  const heading = mem8[PLAYER_HEADING];
  if (heading !== wanted) {
    const delta = u8(heading - wanted);
    const step = (mem8[ERA_INDEX] & 0x0f) >= FAST_DIGIT ? FAST_STEP : SLOW_STEP;
    if (u8(delta + 1) < WITHIN_ONE_NOTCH) mem8[PLAYER_HEADING] = wanted;
    else if (delta >= HALF_TURN) mem8[PLAYER_HEADING] = u8(heading + step);
    else mem8[PLAYER_HEADING] = u8(heading - step);
  }
  return scrollWorldAtTheEraPace(m);
}
