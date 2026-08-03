// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer1Context — reset the live player/display context to player 1, single-player,
 * sub-state 0, with the flip-screen latch forced ON.  ROM 0x13bb.
 *
 * Idx 19 of the in-game sub-state table (ROM 0x0702), dispatched by
 * dispatchInGameSubstate (ROM 0x06fe) when GAME_STATE(0x6005)==3 and
 * GAME_SUBSTATE(0x600A)==0x13. It writes four FIXED bytes and reads nothing — a
 * constant function of no inputs:
 *
 *   - CURRENT_PLAYER (0x600D) = 0  -> player 1 is up
 *   - ACTIVE_PLAYER_INDEX (0x600E) = 0 -> player 1 is the active player. ram.js names
 *                                     0x600E the active-player index (low byte, lockstep
 *                                     mirror of CURRENT_PLAYER); it is ALSO the
 *                                     1-player-start marker configureFlipScreenAndSelectSubstate
 *                                     reads as "== 0 -> 1-player". NOT TWO_PLAYER_GAME,
 *                                     which is the high byte 0x600F and is left untouched
 *   - GAME_SUBSTATE  (0x600A) = 0  -> restart the in-game sub-state sequence
 *   - flip-screen    (0x7D82) = 1  -> upright orientation (player 1 never sees the
 *                                     cocktail mirror)
 *
 * The (0x600D, 0x600E) pair is the CURRENT_PLAYER byte and the adjacent
 * ACTIVE_PLAYER_INDEX byte loc_08f8 wrote at game start; this routine clears both. It is the
 * player-1 half of a mirror pair with loc_13aa (idx 18), which instead sets that pair to
 * (1, 1) — selecting player 2 — and sets the flip latch from the cabinet DIP
 * (DIP_UPRIGHT 0x6026), so a cocktail player 2 gets the mirrored view. ram.js
 * corroborates the player-select half: CURRENT_PLAYER is "toggled on the player
 * switch (loc_13aa sets 1, loc_13bb clears 0)".
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): ram.js CURRENT_PLAYER (0x600D)
 * cites it explicitly — "toggled on the player switch (loc_13aa sets 1, loc_13bb clears 0)".
 * It writes CURRENT_PLAYER / ACTIVE_PLAYER_INDEX / GAME_SUBSTATE = 0 plus the flip latch = 1,
 * the player-1 mirror of loc_13aa. The immediate siblings loc_138f / loc_13a1 stay loc_.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13bb.test.js.
 * GATE:     crafted-entry; 0x13bb dispatches ZERO times in 6000 attract frames and
 *           in 1P/2P coin+start runs (its sub-state is reached only in a credited
 *           game's player-switch path), so — per docs/decompiler-pipeline for arms attract never
 *           reaches — the gate is crafted from real booted machines. The routine
 *           reads nothing (a constant function), so the sweep pre-dirties all four
 *           outputs + the flip latch to sentinels over several diverse bases and
 *           confirms identical RAM (ex-stack) + io.flipScreen to the oracle on each,
 *           plus the fixed outcome. 0x7D82 is NOT in the RAM dump, so io.flipScreen
 *           is compared. Teeth = wrong CURRENT_PLAYER, a skipped flip-set, a skipped
 *           ACTIVE_PLAYER_INDEX write.
 * LIVE-OUT: memory + the 0x7D82 flip-screen latch. Memory: CURRENT_PLAYER(0x600D),
 *           ACTIVE_PLAYER_INDEX(0x600E), GAME_SUBSTATE(0x600A) all cleared to 0. The flip
 *           latch is an io board output (outside the RAM dump), pinned via
 *           io.flipScreen. No live registers/flags — the rst-0x28 sub-state dispatch
 *           returns up the NMI path and consumes none; the oracle's residual A=1 is
 *           dead ABI. SP/PC are not compared (the direct-call layer replaces the
 *           oracle's `ret` stack/PC bookkeeping with the JS call stack).
 * NAMES:    CURRENT_PLAYER (0x600D), ACTIVE_PLAYER_INDEX (0x600E), GAME_SUBSTATE
 *           (0x600A) from ram.js. 0x7D82 (flip-screen board latch) is not work RAM, so
 *           it stays a local hex constant (same convention as
 *           configureFlipScreenAndSelectSubstate). NB TWO_PLAYER_GAME is 0x600F (the
 *           high byte) and is NOT written here.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, GAME_SUBSTATE } from "./ram.js";

// Flip-screen control latch (ls259.6h bit 2) — a board hardware register, not work
// RAM, so it lives outside ram.js as a local constant.
const FLIPSCREEN = 0x7d82;

export function selectPlayer1Context(m) {
  const { mem } = m;
  mem.write8(CURRENT_PLAYER, 0); // 0x600D = 0 -> player 1 up
  mem.write8(ACTIVE_PLAYER_INDEX, 0); // 0x600E = 0 -> player-1 active-player index
  mem.write8(GAME_SUBSTATE, 0); // 0x600A = 0 -> restart the in-game sub-state sequence
  mem.write8(FLIPSCREEN, 1); // 0x7D82 = 1 -> flip-screen ON (upright orientation)
}
