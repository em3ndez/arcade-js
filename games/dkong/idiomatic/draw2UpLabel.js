// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw2UpLabel — stamp the three fixed video-RAM cells of player 2's "2UP" score
 * marker.  ROM 0x09EE.
 *
 * The player-2 counterpart of draw1UpLabel (ROM 0x0A53). Donkey Kong shows a
 * per-player score marker at the top of the screen: three tiles down one video-RAM
 * column — the player-number digit, then 'U', then 'P'. Two other routines pin the
 * structure:
 *
 *   - sub_0347 (ROM 0x0347) is the per-player COLUMN SELECTOR: it returns the
 *     column base 0x7740 for player 1 and 0x74E0 for player 2 (CURRENT_PLAYER
 *     0x600D non-zero).
 *   - sub_0315 (ROM 0x0315) MAINTAINS and blinks the marker every 16th frame,
 *     writing the triple (CURRENT_PLAYER + 1, 0x25, 0x20) down the selected column.
 *
 * This routine is the STATIC one-shot draw of player 2's marker. It force-writes
 * the P2 column unconditionally — 0x74E0 <- 0x02 ('2'), 0x74C0 <- 0x25 ('U'),
 * 0x74A0 <- 0x20 ('P') — the exact three cells sub_0315 later maintains for P2. It
 * is drawn only when a second player exists: handler_0779 (attract setup) reaches
 * it via `call z,0x09EE` guarded by `ld a,(TWO_PLAYER_GAME 0x600F) / cp 0x01`
 * (ROM 0x07A0), and it is the unconditional fall-through tail of sub_0a1b (the
 * player-alternation setup, called at ROM 0x0A2E). Input-independent, straight-line,
 * no branch. A LEAF — calls nothing.
 *
 * The cells step 0x20 bytes (one tilemap row) apart. The glyph decode: the digit
 * '2' (tile 0x02) is verified — for player 2 CURRENT_PLAYER is non-zero, so
 * sub_0315 writes CURRENT_PLAYER+1 == 2 into this same cell — while 'U'/'P'
 * (0x25/0x20) are the conventional Donkey Kong font and are inferred, not proven
 * in-repo. The routine's role (stamp the P2 score marker sub_0315 blinks) does not
 * depend on the letter decode.
 *
 * Memory-equivalent to the frozen oracle — equivalence-09ee.test.js.
 * GATE:     crafted-entry — input-independent and straight-line (no data-dependent
 *           branch, so no unreached arms); validated on real captured dispatches
 *           (a FRESH clone per case, since it writes video RAM) PLUS crafted
 *           pre-dirtied entries that prove it stamps the three constants whatever
 *           the cells held before. 2-player-only: plain 1-player attract never
 *           reaches it, so the capture forces the real 2-player guard
 *           (TWO_PLAYER_GAME=1) so the ROM's own `call z,0x09EE` fires (frame 6).
 * LIVE-OUT: memory-only — the three video-RAM cells. Both call sites overwrite the
 *           register the routine leaves before reading it (handler_0779 does
 *           `ld de,(0x6022)` at 0x07A3; sub_0a1b does `ld a,0x05` at 0x0A31) and
 *           consume no flag it leaves; the oracle's terminal `ret` (an SP+2 pop) is
 *           the modelled stack ABI the direct-call layer replaces with a JS return,
 *           so SP/pc are not live either.
 * NAMES:    none from ram.js — the three targets are video RAM (0x7400-0x77FF),
 *           outside ram.js's work-RAM map, so they stay local hex constants (the
 *           optimized layer held them hex for the same reason).
 */

// Player 2's "2UP" marker column base in video RAM; sub_0347 picks this for P2
// (0x7740 for P1). The three marker cells step one tilemap row apart, descending.
const P2_MARKER_BASE = 0x74e0;
const TILEMAP_ROW = 0x20;

// Tile codes of the marker, in Donkey Kong's font: 0x02 = '2' (the player-number
// digit — verified via sub_0315's CURRENT_PLAYER+1 write for P2), 0x25 = 'U',
// 0x20 = 'P'.
const TILE_DIGIT_2 = 0x02;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw2UpLabel(m) {
  const { mem } = m;
  mem.write8(P2_MARKER_BASE, TILE_DIGIT_2); //                  0x74E0 <- '2'
  mem.write8(P2_MARKER_BASE - TILEMAP_ROW, TILE_U); //          0x74C0 <- 'U'
  mem.write8(P2_MARKER_BASE - 2 * TILEMAP_ROW, TILE_P); //      0x74A0 <- 'P'
}
