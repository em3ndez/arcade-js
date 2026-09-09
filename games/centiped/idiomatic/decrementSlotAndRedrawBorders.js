// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_88, loc_a4 } from "./names.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";
import { reseedSegmentSpawnState } from "./reseedSegmentSpawnState.js";

/**
 * decrementSlotAndRedrawBorders -- count the current object slot's $a4 timer down by one, repaint the two
 * vertical grid borders, then hand off into the segment/wave reseed chain. ROM 0x25?? (death/respawn tail).
 *
 * Role in the machine: the short chain the death/respawn dispatcher tails into whenever a spawn slot's
 * turn is over. Its whole job is three steps -- age the slot's phase timer, keep the field frame intact by
 * repainting the two vertical side-borders (which the slot churn can disturb), and then re-enter the
 * segment-spawn reseed chain that sets up the next wave of segments.
 *
 * Live-out: $a4+$88 decremented, the two grid side-borders redrawn, plus everything the reseed chain
 * writes. Grounding: [code].
 */
export function decrementSlotAndRedrawBorders(m) {
  const { mem8 } = m;
  // $88 selects the current object slot; $a4 (indexed by it) is that slot's phase/dwell timer. Age it by
  // one so the slot progresses toward its next state.
  const slot = mem8[loc_88];
  mem8[u8(loc_a4 + slot)] = u8(mem8[u8(loc_a4 + slot)] - 1);
  // Repaint the two vertical grid side-borders so the playfield frame survives the slot churn.
  drawGridSideBorders(m);
  // Tail into the segment/wave reseed chain, which rebuilds the segment spawn state for what comes next.
  return reseedSegmentSpawnState(m);
}
