// SPDX-License-Identifier: GPL-3.0-only
/**
 * easeActorToRest — per-frame coordinate stepper: eases an actor's coordinate down to a
 * resting floor and keeps its shadow twin a fixed 16 ahead.  ROM 0x3968.
 *
 * Reached each frame from the actor's cadence front end (paceActorCadence). What it does:
 *   - It acts only on every FOURTH tick of the cadence timer. On the other three
 *     ticks it changes nothing and hands straight off to the shared record builder.
 *   - On a fourth tick it looks at the actor's coordinate. While the coordinate is
 *     still at or above the limit of 193 it steps it down by one and mirrors the
 *     new value plus 16 into the shadow twin; once the coordinate has dropped below
 *     193 it does nothing. So the coordinate eases downward and comes to rest at 192,
 *     with the twin trailing a constant 16 above it.
 *   - Every path finishes by handing off to the shared two-record builder,
 *     stageActorSpriteRecords, which rebuilds the sprite records from these same two
 *     coordinates. That builder takes nothing and returns nothing, so this routine
 *     returns nothing meaningful either.
 *
 * The name stays neutral: which actor this drives and whether the coordinate is a
 * screen X or Y are not pinned in the mechanism map, and the coordinate bytes it
 * touches are only fair-confidence names — not enough to earn an English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3968.test.js.
 * GATE:     captured dispatches + exhaustive. Reached naturally in attract (483
 *           dispatches over 3000 frames, 96 on the step-down arm); swept over all
 *           65,536 (timer, coordinate) combinations so the below-limit and
 *           not-a-fourth-tick arms are covered too; plus teeth.
 * LIVE-OUT: memory-only — the coordinate (0x810a) and its twin (0x811b), plus the
 *           two sprite records the tail builder stages from them. The value registers
 *           this routine leaves are dead ABI (nothing downstream reads them before
 *           overwriting them), and the whole-machine gate backstops that.
 * NAMES:    ENEMY3_TIMER (0x8112, cadence timer), ENEMY3_X (0x810a, the coordinate),
 *           ENEMY3_TWIN_X (0x811b, the shadow twin) — all fair-confidence.
 */

import { ENEMY3_TIMER, ENEMY3_X, ENEMY3_TWIN_X } from "./names.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

export function easeActorToRest(m) {
  const { mem8 } = m;

  // Only every fourth cadence tick does anything at all.
  if (mem8[ENEMY3_TIMER] % 4 === 0) {
    const coord = mem8[ENEMY3_X];
    // Step the coordinate down by one only while it is still at or above the limit;
    // it therefore eases downward and settles at 192.
    if (coord >= 193) {
      const stepped = coord - 1;
      mem8[ENEMY3_X] = stepped;
      mem8[ENEMY3_TWIN_X] = stepped + 16; // the twin trails a constant 16 above
    }
  }

  // Hand off to the shared record builder, which rebuilds the two sprite records
  // from the coordinates just written. It takes nothing and returns nothing.
  return stageActorSpriteRecords(m);
}
