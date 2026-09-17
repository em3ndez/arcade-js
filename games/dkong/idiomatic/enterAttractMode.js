// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterAttractMode — reset the machine into attract mode. The tail of the player-record search:
 * when no slot holds a game in play it falls through here to drive the flip-screen latch, set
 * GAME_STATE = 1 (attract) and ATTRACT = 1, and clear GAME_SUBSTATE. Reads nothing.
 *
 * LIVE-OUT: memory-only — the caller consumes no register or flag this leaves.
 */

import { GAME_STATE, ATTRACT, GAME_SUBSTATE } from "./names.js";

// Flip-screen latch — a write-only board control output (video orientation), NOT work RAM.
const FLIPSCREEN_LATCH = 0x7d82;

export function enterAttractMode(m) {
  const { mem, mem8 } = m;
  mem.write8(FLIPSCREEN_LATCH, 1); // board output (write-only) — not in the RAM dump
  mem8[GAME_STATE] = 1;
  mem8[ATTRACT] = 1;
  mem8[GAME_SUBSTATE] = 0;
}
