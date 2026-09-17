// SPDX-License-Identifier: GPL-3.0-only
/**
 * searchPlayerObjectOverlap — stage the three inputs the current board's overlap-search arm
 * consumes (object base, a search bound of the player's Y + 12, and an overlap-threshold word
 * chosen by whether a left/right direction is held), then tail-dispatch to that arm and return its
 * severity code.
 *
 * LIVE-OUT: memory, plus the severity code the caller consumes after the dispatch.
 */

import { MARIO_ACTIVE, MARIO_Y, P1_INPUT } from "./names.js";
import { dispatchBoardOverlapSearch } from "./dispatchBoardOverlapSearch.js";

// Each byte is one per-axis overlap threshold; the word is selected by whether a direction is held.
const OVERLAP_THRESHOLDS_NEUTRAL = 0x0508;
const OVERLAP_THRESHOLDS_DIRECTED = 0x1308;

export function searchPlayerObjectOverlap(m) {
  const { regs, mem8 } = m;

  regs.iy = MARIO_ACTIVE;
  regs.c = mem8[MARIO_Y] + 12;
  regs.hl = (mem8[P1_INPUT] & 0x03) === 0
    ? OVERLAP_THRESHOLDS_NEUTRAL
    : OVERLAP_THRESHOLDS_DIRECTED;

  return dispatchBoardOverlapSearch(m);
}
