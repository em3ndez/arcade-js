// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterAttractMode — reset the machine into attract mode.
 *
 * The tail of the player-record search: that search scans the five player slot records for
 * one marked as a game still in play, and when NEITHER is found it falls through here to put
 * the cabinet back into its idle attract demo. Four unconditional stores do that:
 *
 *   - the flip-screen latch := 1  — a board control output (video orientation), set as part
 *                                   of the attract display setup;
 *   - GAME_STATE := 1             — top-level state 1 is attract, so the next vblank
 *                                   dispatches the attract handler;
 *   - ATTRACT := 1                — the "no credited game in progress" flag;
 *   - GAME_SUBSTATE := 0          — clears the in-state sub-dispatch index.
 *
 * It reads NOTHING — no memory, no register, no argument — so its effect is constant
 * regardless of the machine state it is entered with. It is the same attract-entry write set
 * the power-on path issues. A LEAF: it calls nothing.
 *
 * Three of the four stores land in work RAM. The flip-screen latch is a write-only board
 * output, so it never appears in a RAM dump, but it is issued faithfully so the display
 * really flips.
 *
 * LIVE-OUT: memory-only — the caller consumes no register or flag this leaves.
 */

import { GAME_STATE, ATTRACT, GAME_SUBSTATE } from "./names.js";

// Flip-screen latch — a write-only board control output (video orientation), NOT
// work RAM; driven to 1 as part of the attract-mode display setup.
const FLIPSCREEN_LATCH = 0x7d82;

export function enterAttractMode(m) {
  const { mem } = m;
  mem.write8(FLIPSCREEN_LATCH, 1); // board output (write-only) — not in the RAM dump
  mem.write8(GAME_STATE, 1); //      top-level state 1 = attract
  mem.write8(ATTRACT, 1); //         no credited game in progress
  mem.write8(GAME_SUBSTATE, 0); //   clear the sub-dispatch index
}
