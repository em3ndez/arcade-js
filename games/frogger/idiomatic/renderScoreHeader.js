// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreHeader  —  ROM 0x0b1f  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The score-row painter. Once per frame it redraws Frogger's three-column score header straight from the
 *   live score words in RAM — there is no cached copy, so whatever the score bytes hold this frame is what
 *   the header shows next frame:
 *       • HI-SCORE column — the "HI-SCORE" label strip, then the high score.
 *       • 1-UP column     — a "1" numeral, the shared "-UP" strip, then player 1's score.
 *       • 2-UP column     — a "2" numeral, "-UP", then player 2's score. Drawn ONLY in two-player mode.
 *
 * WHERE IT SITS
 *   A pure composer over four lower-level tilemap primitives; it owns no memory cell of its own and does no
 *   stamping directly. It threads pointers and score words into:
 *       copyRunUpTileColumn (0x0028)  — blits a ROM tile strip up a VRAM column (labels + the "-UP" strip)
 *       writeScoreField     (0x0b95)  — prints a packed-BCD word as a five-cell score readout
 *       writeScoreDigitStepUp (0x0ba9) — stamps one numeral and hands back the stepped write pointer
 *   It is called every "head" pass of the vblank/frame path (after the mode dispatcher, just before the
 *   credit line) and again from the board-start / new-game / next-life paths
 *   (coldStartClearPlayRamAndSetMode, setUpBoardOrContinueLife, beginNextLifeOrIntro), so the header stays
 *   current whether the game is in attract, mid-board, or between lives.
 *
 * HOW THE COLUMNS ARE LAID OUT
 *   The Galaxian-derived video hardware stores the tilemap rotated: two cells one row apart on screen are
 *   32 addresses apart in memory. Every primitive here therefore walks its pointer UP one 32-cell row per
 *   cell, which paints a horizontal run of glyphs on the physical screen. That is why writeScoreDigitStepUp
 *   returns a pointer already stepped one row past the numeral it stamped — it lands exactly where the next
 *   strip in that column begins, so the "-UP" blit can chain straight off it with no address arithmetic.
 *
 * LIVE-OUT
 *   Memory only — the score-header tilemap cells. The pointer it returns on the two-player path is not
 *   consumed by any caller.
 */
import {
  HIGH_SCORE, PLAYER1_SCORE, PLAYER2_SCORE, NUM_PLAYERS, HI_SCORE_LABEL_STRIP, UP_LABEL_STRIP,
  HISCORE_LABEL_DST, HISCORE_VALUE_DST, P1_DIGIT_DST, P1_SCORE_DST, P2_SCORE_DST,
  SCORE_DISPLAY_VRAM_PAGE,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreField } from "./writeScoreField.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

// The "HI-SCORE" label is an 8-tile ROM strip (HI_SCORE_LABEL_STRIP 0x2ee2); the shared "-UP" side label is
// 3 tiles (UP_LABEL_STRIP 0x2edf). These are the byte counts handed to copyRunUpTileColumn.
const HISCORE_LABEL_LEN = 8;
const SIDE_LABEL_LEN = 3;

// NUM_PLAYERS (0x8370) holds the number of players; a value of 1 means single-player, which suppresses the
// entire 2-UP column below.
const ONE_PLAYER = 1;

export function renderScoreHeader(m) {
  const { mem8, mem16 } = m;

  // ── HI-SCORE column ──────────────────────────────────────────────────────────────────
  // Blit the 8-tile "HI-SCORE" label (ROM HI_SCORE_LABEL_STRIP 0x2ee2) up the label column at
  // HISCORE_LABEL_DST (0xaa60), then print the high score itself. HIGH_SCORE (0x83ef) is a 16-bit
  // packed-BCD word — hence the mem16 read — drawn as a five-cell score field (four digits + trailing "0")
  // at HISCORE_VALUE_DST (0xaa41).
  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HI_SCORE_LABEL_STRIP, HISCORE_LABEL_LEN);
  writeScoreField(m, mem16[HIGH_SCORE], HISCORE_VALUE_DST);

  // ── 1-UP column ──────────────────────────────────────────────────────────────────────
  // Stamp the player-number numeral "1" at P1_DIGIT_DST (0xab20). writeScoreDigitStepUp writes the glyph
  // (the tile index IS the digit — char-ROM tiles 0..9 are the numerals 0..9) and hands back the pointer
  // stepped one 32-cell row up, i.e. the top cell of this column's "-UP" strip. Blit the shared 3-tile
  // "-UP" label (UP_LABEL_STRIP 0x2edf) up from there, then print PLAYER1_SCORE (0x83ed, 16-bit BCD word)
  // as a score field at P1_SCORE_DST (0xab41).
  const p1UpStripTop = writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, p1UpStripTop, UP_LABEL_STRIP, SIDE_LABEL_LEN);
  writeScoreField(m, mem16[PLAYER1_SCORE], P1_SCORE_DST);

  // In a one-player game there is no second score to show, so stop here before the 2-UP column.
  if (mem8[NUM_PLAYERS] === ONE_PLAYER) return;

  // ── 2-UP column (two-player only) ──────────────────────────────────────────────────────
  // Same shape as the 1-UP column with the numeral "2". Its digit sits at the base cell of the
  // score-display VRAM page SCORE_DISPLAY_VRAM_PAGE (0xa900); the stepped pointer again marks the top of
  // the "-UP" strip, and PLAYER2_SCORE (0x83eb) is drawn at P2_SCORE_DST (0xa921). The final writeScoreField
  // return is a spent pointer no caller reads (see LIVE-OUT).
  const p2UpStripTop = writeScoreDigitStepUp(m, 2, SCORE_DISPLAY_VRAM_PAGE);
  copyRunUpTileColumn(m, p2UpStripTop, UP_LABEL_STRIP, SIDE_LABEL_LEN);
  return writeScoreField(m, mem16[PLAYER2_SCORE], P2_SCORE_DST);
}
