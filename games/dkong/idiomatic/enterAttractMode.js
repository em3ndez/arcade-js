// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterAttractMode — reset the machine into attract mode.  ROM 0x1475.
 *
 * The tail of loc_141e's player-record search (ROM 0x141E): that routine scans the
 * five PLAYER_SLOT_RECORDS (0x611C) for one marked 1 or 3 (a game still in play);
 * when NEITHER is found it falls through here (`jp 0x1475`) to put the cabinet back
 * into its idle attract demo. Four unconditional stores do that:
 *
 *   - flip-screen latch 0x7D82 := 1  — board control output (video orientation),
 *                                      set as part of the attract display setup;
 *   - GAME_STATE (0x6005) := 1        — top-level state 1 = attract, so the next
 *                                      vblank dispatches the attract handler;
 *   - ATTRACT (0x6007) := 1           — the "no credited game in progress" flag;
 *   - GAME_SUBSTATE (0x600A) := 0     — clears the in-state sub-dispatch index.
 *
 * It reads NOTHING — no memory, no register, no argument — so its effect is a
 * constant regardless of the machine state it is entered with; it is the same
 * attract-entry write set handler_01c3 issues from power-on. A LEAF (calls nothing).
 * Of the four stores, only 0x6005/0x6007/0x600A land in work RAM (the diffed state);
 * 0x7D82 is a write-only board output (io side, not RAM) — it never appears in the
 * dump but is issued faithfully so the shipped display flips.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1475.test.js.
 * GATE:     crafted-entry — input-independent, straight-line (reads nothing, no
 *           data-dependent branch, so no unreached arms). Validated on real captured
 *           machine states (fresh clone per case — it writes RAM) PLUS crafted
 *           pre-dirtied entries proving it overwrites any prior 0x6005/0x6007/0x600A.
 *           Its own dispatch site is not reached in attract (loc_141e's neither-found
 *           fall-through never fires there), so realistic entries are sourced at a hot
 *           reachable dispatch (rst 0x18) — valid because the routine ignores all input.
 * LIVE-OUT: memory-only — the caller (the game-state dispatcher) consumes no register
 *           or flag this leaves; the oracle's residual A = 0 is dead ABI. pc AND SP are
 *           BOTH dead here: the oracle's terminal `m.ret` pops the stack (SP+2) AND
 *           sets pc to the popped return address — the modelled stack ABI the
 *           direct-call layer replaces with a JS return — so neither is compared.
 * NAMES:    GAME_STATE, ATTRACT, GAME_SUBSTATE (ram.js). 0x7D82 is a board control
 *           output, not work RAM, so it stays a local hex constant.
 */

import { GAME_STATE, ATTRACT, GAME_SUBSTATE } from "./ram.js";

// Flip-screen latch — a write-only board control output (video orientation), NOT
// work RAM; driven to 1 as part of the attract-mode display setup.
const FLIPSCREEN_LATCH = 0x7d82;

export function enterAttractMode(m) {
  const { mem } = m;
  mem.write8(FLIPSCREEN_LATCH, 1); // board output (write-only) — not in the RAM dump
  mem.write8(GAME_STATE, 1); //      0x6005 — top-level state 1 = attract
  mem.write8(ATTRACT, 1); //         0x6007 — no credited game in progress
  mem.write8(GAME_SUBSTATE, 0); //   0x600A — clear the sub-dispatch index
}
