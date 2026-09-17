// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioDownWithLift — the descending-lift arm: step Mario one pixel down (larger Y is
 * lower), mirroring the new Y into his sprite record, or kill him once his Y reaches the
 * bottom limit. The limit is an absolute row of Mario's own; no object record is read.
 *
 * LIVE-OUT: memory-only — Mario's Y and sprite-record Y on the step arm; on the end-of-run
 * arm, the cells the kill clears.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";

const MARIO_SPRITE_Y = MARIO_SPRITE_RECORD + SPRITE_Y;
const Y_LIMIT = 232;

export function carryMarioDownWithLift(m) {
  const { mem8 } = m;

  const y = mem8[MARIO_Y];

  if (y >= Y_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  const next = y + 1;
  mem8[MARIO_Y] = next;
  mem8[MARIO_SPRITE_Y] = next;
}
