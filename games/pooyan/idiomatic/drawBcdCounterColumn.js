// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { renderDigitWithBlanking } from "./renderDigitWithBlanking.js";
import {
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_BCD_HI,
  P1_SCORE_VRAM,
  P2_SCORE_VRAM,
  HIGH_SCORE_VRAM,
} from "./names.js";
/**
 * drawBcdCounterColumn — paint one of the machine's three score counters down its video column.
 *
 * WHAT IT IS
 *   ROM 0x056b (through 0x059c). Grounding: [seen].
 *   The machine keeps three running totals as packed-BCD counters: the player-1 score, the
 *   player-2 score, and the high score. Each is three bytes wide, and packed BCD stores two
 *   decimal digits per byte (high nibble = the more-significant digit of the pair, low nibble
 *   = the less-significant), so three bytes spell out a six-digit number. This routine takes
 *   one of those counters and stamps its six digits, top to bottom, into a fixed column of
 *   video RAM — the on-screen score readout.
 *
 * ROLE IN THE MACHINE
 *   The score-rendering primitive. After the scoring logic BCD-adds an award into the active
 *   player's counter it calls this to repaint that counter's column; when a new score beats the
 *   high score, the high-score counter is copied and this repaints the high-score column too.
 *   The attract-screen HUD composer drives it the same way to lay down the scores at rest.
 *
 * HOW IT WORKS
 *   A selector (0 = player 1, 1 = player 2, anything else = high score) picks two things at
 *   once: which counter's bytes to read and which screen column to write. The counter is read
 *   most-significant byte first and walked downward toward the least-significant byte; within
 *   each byte the high digit is painted before the low digit. Every digit is handed to the
 *   per-digit painter renderDigitWithBlanking, which stamps one tile and advances the cursor by
 *   ROW_UP to the next cell in the column. A single leading-zero "blank budget" is threaded
 *   through all six calls so that the high-order zeros of a small number come out as blank tiles
 *   instead of a row of 0s.
 *
 * LIVE-OUT
 *   Up to six tiles written into the selected score column of video RAM. Memory-only: it paints
 *   cells and returns nothing.
 */

// The per-digit step through the column: -0x20 moves the write cursor one tilemap row along,
// so consecutive digits land in adjacent cells of the same column.
const ROW_UP = -0x20;
// Each counter is three packed-BCD bytes wide (six decimal digits total).
const DIGIT_BYTES = 3;
// Leading-zero blanking allowance for the column: the four most-significant digit positions may
// be suppressed to blank tiles, so the two least-significant digits always print. A counter
// sitting at zero therefore reads as four blanks followed by "00".
const BLANK_BUDGET = 4;

export function drawBcdCounterColumn(m, selector = m.regs.a) {
  const { mem8 } = m;

  // Resolve the selector to a (source, cursor) pair: `source` is the address of the counter's
  // most-significant byte, `cursor` is the base cell of that counter's on-screen column. Reading
  // from the top byte down is what makes leading-zero blanking work — the blankable positions are
  // the most-significant digits, so they must be visited first.
  let source, cursor;
  if (selector === 0) {
    // Player 1: the three-byte score buffer is P1_SCORE_BCD..+2, so +2 is its top byte; the
    // digits go into the player-1 score column.
    source = P1_SCORE_BCD + 2;
    cursor = P1_SCORE_VRAM;
  } else if (selector === 1) {
    // Player 2: same layout in the player-2 buffer and the player-2 score column.
    source = P2_SCORE_BCD + 2;
    cursor = P2_SCORE_VRAM;
  } else {
    // High score: HIGH_SCORE_BCD_HI already names the top byte of the high-score counter; the
    // digits go into the high-score (top-of-screen) column.
    source = HIGH_SCORE_BCD_HI;
    cursor = HIGH_SCORE_VRAM;
  }

  // Seed the shared leading-blank allowance and start the read at the top byte.
  let budget = BLANK_BUDGET;
  let src = source;
  // Walk the counter one byte at a time, most-significant byte first, working down toward the
  // least-significant byte.
  for (let i = 0; i < DIGIT_BYTES; i++) {
    const byte = mem8[src];
    // High nibble = the more-significant digit of this byte pair. Paint it, then take back the
    // advanced cursor and the updated blank budget so the next digit continues from both.
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_UP, (byte >> 4) & 0x0f, budget);
    // Low nibble = the less-significant digit of the pair; paint it into the following cell.
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_UP, byte & 0x0f, budget);
    // Step down to the next-less-significant byte (16-bit wrap), keeping the shared budget so a
    // significant digit already seen stops any further blanking for the rest of the column.
    src = u16(src - 1);
  }
}
