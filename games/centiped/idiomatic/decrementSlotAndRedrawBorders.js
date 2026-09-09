// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_88, loc_a4 } from "./names.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";
import { reseedSegmentSpawnState } from "./reseedSegmentSpawnState.js";

/**
 * decrementSlotAndRedrawBorders -- count the current object slot's $a4 timer down by one, repaint the
 * two vertical grid borders, then hand off into the segment/wave reseed chain. [code]
 */
export function decrementSlotAndRedrawBorders(m) {
  const { mem8 } = m;
  const slot = mem8[loc_88];
  mem8[u8(loc_a4 + slot)] = u8(mem8[u8(loc_a4 + slot)] - 1);
  drawGridSideBorders(m);
  return reseedSegmentSpawnState(m);
}
