// SPDX-License-Identifier: GPL-3.0-only
/**
 * easeActorToRest — ease an actor's coordinate down to a resting floor, keeping its shadow twin a fixed 16 ahead.
 *
 * Reached each frame from the actor's cadence front end. It acts only on every fourth
 * cadence tick; on the others it changes nothing. On a fourth tick, while the coordinate
 * is still at or above 193 it steps it down by one and mirrors the new value plus 16 into
 * the twin — so the coordinate eases down and rests at 192, the twin trailing 16 above.
 * Every path hands off to the shared record builder, which rebuilds the sprite records.
 */

import { ENEMY3_TIMER, ENEMY3_X, ENEMY3_TWIN_X } from "./names.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

export function easeActorToRest(m) {
  const { mem8 } = m;

  // Only every fourth cadence tick does anything at all.
  if (mem8[ENEMY3_TIMER] % 4 === 0) {
    const coord = mem8[ENEMY3_X];
    // Step down only while at or above the limit; it eases down and settles at 192.
    if (coord >= 193) {
      const stepped = coord - 1;
      mem8[ENEMY3_X] = stepped;
      mem8[ENEMY3_TWIN_X] = stepped + 16; // the twin trails a constant 16 above
    }
  }

  // Hand off to the shared record builder, which rebuilds the two sprite records.
  return stageActorSpriteRecords(m);
}
