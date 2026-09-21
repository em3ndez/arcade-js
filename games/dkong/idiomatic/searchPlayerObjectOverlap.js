// SPDX-License-Identifier: GPL-3.0-only
/**
 * searchPlayerObjectOverlap — stage the three inputs the current board's overlap-search arm
 * consumes (object base, a search bound of the player's Y + 12, and an overlap-threshold word
 * chosen by whether a left/right direction is held), then tail-dispatch to that arm and return its
 * severity code.
 *
 * LIVE-OUT: memory, plus the severity code the caller consumes after the dispatch.
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
  const { regs, mem8 } = m;

  // The three staged inputs (object base, Y+12 bound, direction-selected threshold word) ride the
  // return so the frozen dispatch arm reads them off the bridge; last element is its severity code.
  return [regs.iy = MARIO_ACTIVE, regs.c = mem8[MARIO_Y] + 12, regs.hl = (mem8[P1_INPUT] & 0x03) === 0 ? OVERLAP_THRESHOLDS_NEUTRAL : OVERLAP_THRESHOLDS_DIRECTED, dispatchBoardOverlapSearch(m)][3];
}
