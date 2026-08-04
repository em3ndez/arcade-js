// SPDX-License-Identifier: GPL-3.0-only
/**
 * searchPlayerObjectOverlap — run the current board's object-overlap search for the player and hand
 * its severity code back to the caller.
 *
 * A thin setup-and-dispatch step. It prepares the three inputs the board's overlap-search arm
 * consumes, then tail-dispatches to that arm and returns whatever code it produces:
 *   - the object-record base the arm walks (the player/object block),
 *   - a search bound taken from the player's Y plus a fixed offset of 12,
 *   - an overlap-threshold word, chosen by whether a left/right direction is held: the neutral pair
 *     when no direction is pressed, a wider pair otherwise. Its low and high bytes become the two
 *     per-axis thresholds the search compares against.
 *
 * The dispatch is a genuine TAIL call: the selected arm's own return returns straight to THIS
 * routine's caller, so there is no extra frame here. On the girder board the arm counts how many
 * active objects overlap the player and returns a severity code (0, 1, 3 or 7); the caller reads
 * that code back to decide its next move.
 *
 * The overlap-search arms still take their inputs in registers rather than as arguments, so this
 * routine stages the object base, the Y-derived bound and the threshold word into the register file
 * before dispatching.
 *
 * The name is mechanism-descriptive and claims no game-object identity: what the overlapping
 * objects ARE is not asserted here.
 *
 * LIVE-OUT: memory, plus the severity code in the result register the caller consumes right after
 * the dispatch.
 */

import { MARIO_ACTIVE, MARIO_Y, P1_INPUT } from "./names.js";
import { dispatchBoardOverlapSearch } from "./dispatchBoardOverlapSearch.js";

// The two overlap-threshold words. Each byte is load-bearing on its own: the low byte and the high
// byte are the search's two per-axis overlap thresholds. Which word is used is selected by whether
// a left/right direction is held.
const OVERLAP_THRESHOLDS_NEUTRAL = 0x0508; // no direction pressed
const OVERLAP_THRESHOLDS_DIRECTED = 0x1308; // a direction held (wider cross-axis threshold)

export function searchPlayerObjectOverlap(m) {
  const { regs, mem } = m;

  // The object-record block the search arm walks (its base pointer).
  regs.iy = MARIO_ACTIVE;

  // Search bound: the player's Y plus a fixed offset of 12.
  regs.c = mem.read8(MARIO_Y) + 12;

  // Threshold word: the two low bits of the input are the left/right direction; when
  // neither is held use the neutral thresholds, otherwise the directed (wider) pair.
  regs.hl = (mem.read8(P1_INPUT) & 0x03) === 0
    ? OVERLAP_THRESHOLDS_NEUTRAL
    : OVERLAP_THRESHOLDS_DIRECTED;

  // Tail-dispatch to the current board's overlap-search arm; it consumes the base, bound
  // and thresholds above and returns the severity code the caller reads back.
  return dispatchBoardOverlapSearch(m);
}
