// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioUpWithLift — the rising-lift arm: step Mario one pixel up (smaller Y is higher),
 * mirroring the new Y into his sprite record, or kill him once his Y passes the top limit.
 * The limit is an absolute row of Mario's own; no object record is read.
 *
 * LIVE-OUT: memory-only — Mario's Y and sprite-record Y on the step arm; on the hand-off arm,
 * whatever the kill writes.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";

const TOP_LIMIT = 0x71;

export function carryMarioUpWithLift(m) {
  const { mem8 } = m;

  const y = mem8[MARIO_Y];

  if (y < TOP_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  const stepped = y - 1;
  mem8[MARIO_Y] = stepped;
  mem8[MARIO_SPRITE_RECORD + SPRITE_Y] = stepped;
}
