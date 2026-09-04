// SPDX-License-Identifier: GPL-3.0-only
import { drawTaitoCopyright } from "./drawTaitoCopyright.js";
import { resolveShotAndFleetEdge } from "./resolveShotAndFleetEdge.js";

/**
 * updateFleetAndDrawCopyright (ROM 0x0bf1) -- a redraw trampoline pairing a state step with a gated draw.
 *
 * WHAT IT IS
 *   Runs two things in sequence: first resolveShotAndFleetEdge (the state-2 player-shot resolution followed
 *   by the fleet edge/direction reversal update), then tails into drawTaitoCopyright. The odd pairing is why
 *   it reads as a "trampoline" -- it is the call site through which the Taito copyright line gets its chance
 *   to draw each pass while the fleet/shot state is also advanced.
 *
 * ROLE IN THE MACHINE
 *   drawTaitoCopyright does not paint unconditionally: it sits behind a two-stage input code on port 1
 *   (INPUT_CODE_STAGE_FLAG, 0x201e), demanding a specific masked value at each stage, so the copyright
 *   surfaces only after that combination is entered. This routine is the wrapper mechanisms.md refers to as
 *   "reached through updateFleetAndDrawCopyright, which calls another routine and then hands straight into
 *   it". resolveShotAndFleetEdge is RAM-only (callers ignore its result); the tail return forwards whatever
 *   drawTaitoCopyright leaves.
 *
 * ROM 0x0bf1.  Grounding: [seen] (names.js cert for 0x0bf1).
 *
 * LIVE-OUT: inherited from drawTaitoCopyright (which either returns early without drawing or lays down the
 *   copyright via drawSpriteList).
 */
// Run the pre-round state-and-fleet update, then tail into drawTaitoCopyright -- a redraw trampoline.
export function updateFleetAndDrawCopyright(m) {
  // State step: resolve any in-flight player-shot collision and update the fleet's edge/direction (RAM only).
  resolveShotAndFleetEdge(m);
  // Tail into the input-gated copyright draw, forwarding its result.
  return drawTaitoCopyright(m);
}
