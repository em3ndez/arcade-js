// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw1UpLabel — stamp the three fixed video-RAM cells of player 1's "1UP" score
 * marker.  ROM 0x0A53.
 *
 * Donkey Kong shows a per-player score marker at the top of the screen: three
 * tiles down one video-RAM column — the player-number digit, then 'U', then 'P'
 * ("1UP" / "2UP"). Two other routines pin the structure:
 *
 *   - sub_0347 (ROM 0x0347) is the per-player COLUMN SELECTOR: it returns the
 *     column base 0x7740 when CURRENT_PLAYER (0x600D) is 0 (player 1) and 0x74E0
 *     when it is non-zero (player 2).
 *   - sub_0315 (ROM 0x0315) MAINTAINS and blinks that marker every 16th frame,
 *     writing the triple (CURRENT_PLAYER + 1, 0x25, 0x20) down the selected column
 *     (and the other player's column too, in a 2-player game) and erasing it with
 *     the blank tile 0x10 on the off phase.
 *
 * This routine is the STATIC one-shot draw of player 1's marker. It force-writes
 * the P1 column unconditionally — 0x7740 <- 0x01 ('1'), 0x7720 <- 0x25 ('U'),
 * 0x7700 <- 0x20 ('P') — the exact three cells sub_0315 later maintains. It runs
 * while the top-of-screen furniture is built: called from handler_01c3 (power-on
 * init, ROM 0x01F1) and handler_0779 (attract setup, state 1 sub-state 0, ROM
 * 0x0798); the same three stores also form the fall-through tail of loc_0a37
 * (in-game board setup). Input-independent, straight-line, no branch. A LEAF —
 * calls nothing.
 *
 * The cells step 0x20 bytes (one tilemap row) apart. The glyph decode: the digit
 * '1' (tile 0x01) is verified — sub_0315 writes CURRENT_PLAYER+1 into this same
 * cell — while 'U'/'P' (0x25/0x20) are the conventional Donkey Kong font and are
 * inferred, not proven in-repo. The routine's role (stamp the P1 score marker
 * sub_0315 blinks) does not depend on the letter decode.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a53.test.js.
 * GATE:     crafted-entry — input-independent and straight-line (no data-dependent
 *           branch, so no unreached arms); validated on real captured dispatches
 *           (a FRESH clone per case, since it writes video RAM) PLUS crafted
 *           pre-dirtied entries that prove it stamps the three constants whatever
 *           the cells held before. Reached in attract at frames 5 (handler_01c3)
 *           and 6 (handler_0779).
 * LIVE-OUT: memory-only — the three video-RAM cells. Both call sites overwrite A
 *           before reading it (`ld de,0x0304` at 0x01F4, `ld a,(0x600f)` at 0x079B)
 *           and consume no flag it leaves; the oracle's terminal `ret` (an SP+2
 *           pop) is the modelled stack ABI the direct-call layer replaces with a
 *           JS return, so SP/pc are not live either.
 * NAMES:    none from ram.js — the three targets are video RAM (0x7400-0x77FF),
 *           outside ram.js's work-RAM map, so they stay local hex constants (the
 *           optimized layer held them hex for the same reason).
 */

// Player 1's "1UP" marker column base in video RAM; sub_0347 picks this for P1
// (0x74E0 for P2). The three marker cells step one tilemap row apart.
const P1_MARKER_BASE = 0x7740;
const TILEMAP_ROW = 0x20;

// Tile codes of the marker, in Donkey Kong's font: 0x01 = '1' (the player-number
// digit — verified via sub_0315's CURRENT_PLAYER+1 write), 0x25 = 'U', 0x20 = 'P'.
const TILE_DIGIT_1 = 0x01;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw1UpLabel(m) {
  const { mem } = m;
  mem.write8(P1_MARKER_BASE, TILE_DIGIT_1); //                  0x7740 <- '1'
  mem.write8(P1_MARKER_BASE - TILEMAP_ROW, TILE_U); //          0x7720 <- 'U'
  mem.write8(P1_MARKER_BASE - 2 * TILEMAP_ROW, TILE_P); //      0x7700 <- 'P'
}
