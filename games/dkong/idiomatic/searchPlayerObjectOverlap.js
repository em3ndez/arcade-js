// SPDX-License-Identifier: GPL-3.0-only
/**
 * searchPlayerObjectOverlap — stage the inputs the current board's overlap-search arm consumes
 * (Mario's record base, a search bound of the player's Y + 12, and an overlap-threshold word chosen
 * by whether a left/right direction is held), dispatch to that arm, and return its severity code.
 *
 * LIVE-OUT: memory, plus the severity code the caller consumes (returned).
 */

import {
  MARIO_ACTIVE,
  MARIO_Y,
  OVERLAP_THRESHOLDS_DIRECTED,
  OVERLAP_THRESHOLDS_NEUTRAL,
  P1_INPUT,
} from "./names.js";
import { dispatchBoardOverlapSearch } from "./dispatchBoardOverlapSearch.js";

// Each byte is one per-axis overlap threshold; the word is selected by whether a direction is held.

export function searchPlayerObjectOverlap(m) {
  const { mem8 } = m;

  const bounds = (mem8[P1_INPUT] & 0x03) === 0 ? OVERLAP_THRESHOLDS_NEUTRAL : OVERLAP_THRESHOLDS_DIRECTED;
  return dispatchBoardOverlapSearch(m, { iy: MARIO_ACTIVE, c: mem8[MARIO_Y] + 12, bounds });
}
