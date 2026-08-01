// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2853 — run the current board's object-overlap search for the player and hand its
 * severity code back to the caller.  ROM 0x2853.
 *
 * A thin setup-and-dispatch step. It prepares the three inputs the board's overlap-search
 * arm consumes, then tail-dispatches to that arm and returns whatever code it produces:
 *   - the object-record base the arm walks (the player/object block at 0x6200),
 *   - a search bound taken from the player's Y plus a fixed offset of 12,
 *   - an overlap-threshold word, chosen by whether a left/right direction is held: the
 *     neutral pair when no direction is pressed, a wider pair otherwise. Its low and high
 *     bytes become the two per-axis thresholds the search compares against.
 *
 * The dispatch is a genuine TAIL call: the selected arm's own return returns straight to
 * THIS routine's caller, so the frozen oracle's `call`/`ret` bracket around the dispatch
 * collapses into the JS call/return and there is no extra frame here. On the 25m board the
 * arm counts how many active objects overlap the player and returns a severity code
 * (0/1/3/7); the caller reads that code back to decide its next move.
 *
 * REGISTER-ABI MARSHALLING at a still-oracle boundary: the overlap-search arms (25m's
 * counter and the other boards' collision arms) are still translated and take their inputs
 * in registers, so this routine loads the object base, the Y-derived bound, and the
 * threshold word exactly as the oracle's `call` site loads them, then lets
 * dispatchBoardOverlapSearch route to the current board's arm. That marshalling dissolves
 * once the arms take honest parameters.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2853.test.js.
 * GATE:     crafted-entry — never dispatched in attract (reached only from the still-
 *           translated 0x1C20 caller), so coverage is crafted on a real attract-base
 *           machine: representative player Y over both direction arms through the live 25m
 *           overlap counter, the other boards' dispatch arms, and a single-object entry
 *           placed at the overlap boundary so a wrong bound / threshold / object base each
 *           flips the counted result. Teeth: a wrong-Y-offset twin, an inverted-threshold-
 *           select twin, and a wrong-object-base twin, each caught at OVERLAP_COUNT.
 * LIVE-OUT: memory + the severity code in the result register the caller consumes right
 *           after the dispatch. The oracle's `call 0x3e88` push and terminal `ret` are the
 *           caller-return plumbing the tail dispatch dissolves into the JS call stack; its
 *           pushes land in the dead STACK_SCRATCH the equivalence gate excludes.
 * NAMES:    MARIO_ACTIVE (0x6200, the object-record base), MARIO_Y (0x6205), P1_INPUT
 *           (0x6010) from ram.js; the two packed threshold words kept hex (each byte is a
 *           per-axis overlap threshold). dispatchBoardOverlapSearch (ROM 0x3E88) is the
 *           idiomatic dispatch, called directly.
 */

import { MARIO_ACTIVE, MARIO_Y, P1_INPUT } from "./ram.js";
import { dispatchBoardOverlapSearch } from "./dispatchBoardOverlapSearch.js";

// The two overlap-threshold words. Kept hex because each byte is load-bearing on its own:
// the low byte and the high byte are the search's two per-axis overlap thresholds. Which
// word is used is selected by whether a left/right direction is held.
const OVERLAP_THRESHOLDS_NEUTRAL = 0x0508; // no direction pressed
const OVERLAP_THRESHOLDS_DIRECTED = 0x1308; // a direction held (wider cross-axis threshold)

export function loc_2853(m) {
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
