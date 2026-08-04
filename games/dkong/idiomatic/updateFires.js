// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateFires — one frame of the fire service, in four steps. It computes nothing itself; what it
 * contributes is the ORDER and the two gates that can end the frame's fire work early.
 *
 *   1. THE DIFFICULTY GATE. False means this is simply not one of the frames the fires move on,
 *      and nothing below runs — which is how the fires get faster as the game gets harder without
 *      any of the code below knowing about difficulty.
 *   2. THE CENSUS. Sweep the five fire records, tally the live ones, and admit at most one pending
 *      spawn. False means the array came out empty, so there is nothing to advance and nothing to
 *      draw.
 *   3. THE STATE WALK. Visit the same five records and run the per-fire body on each occupied one.
 *   4. THE PUBLISH. Gather the five records into their five drawn sprite records.
 *
 * ALL THREE ARMS RESUME AT THE SAME PLACE, which is why nothing is returned on any of them. Both
 * early exits happen INSIDE the callee that decides them, and land control exactly where an
 * ordinary return from here lands it — so this routine's two guards are plain returns.
 *
 * IT MUST NOT RETURN THE CALLEES' BOOLEANS. Those two booleans stand for a stack unwind the two
 * callees perform themselves; this routine performs none. A `false` leaving here would make the
 * call seam treat this routine as caller-skip-capable too and discard a second stack word it does
 * not owe.
 *
 * WHAT THE NAME RESTS ON, from this body alone: every one of the four steps addresses the same
 * five-record array, and between them they cover the whole life of what is in it — admit, move,
 * draw. Nothing here is per-board, per-player or per-screen. A name claiming a wider per-frame
 * scope would be refuted by the fact that the routine touches no other array.
 *
 * Reads and writes no memory of its own — everything it touches, it touches through the four
 * steps.
 *
 * LIVE-OUT: memory-only; returns undefined on all three arms.
 */

import { gateFireUpdateByDifficulty } from "./gateFireUpdateByDifficulty.js";
import { spawnRequestedFireAndRecolorLiveFires } from "./spawnRequestedFireAndRecolorLiveFires.js";
import { publishFireSprites } from "./publishFireSprites.js";

/** The return bracket the per-fire state walk's own return consumes. */
const RESUME_AFTER_STATE_WALK = 0x30f6;

/**
 * @param {object} m  the machine.
 * @returns {void}  on every arm — see the header on why a boolean here would be a defect.
 */
export function updateFires(m) {
  // Not this frame's turn: the difficulty gate paces the whole service.
  if (!gateFireUpdateByDifficulty(m)) return;

  // Nothing live in the array: no state to advance and no sprites to gather.
  if (!spawnRequestedFireAndRecolorLiveFires(m)) return;

  // The per-fire state walk, dispatched by address: it returns through its own `ret`, so the
  // bracket that `ret` pops is pushed here as part of the call.
  m.push16(RESUME_AFTER_STATE_WALK);
  m.call(0x31b1);

  publishFireSprites(m);
}
