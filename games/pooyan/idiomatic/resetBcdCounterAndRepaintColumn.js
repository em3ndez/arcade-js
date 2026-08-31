// SPDX-License-Identifier: GPL-3.0-only
import {
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_BCD,
  P1_SCORE_VRAM,
  P2_SCORE_VRAM,
  HIGH_SCORE_VRAM,
} from "./names.js";
import { renderDigitWithBlanking } from "./renderDigitWithBlanking.js";
/**
 * resetBcdCounterAndRepaintColumn — zero one of the machine's three score counters and repaint
 * its on-screen HUD column so the display shows a freshly cleared score.
 *
 * WHAT IT IS
 *   The game keeps three running score values as 3-byte packed-BCD counters in work RAM: player
 *   1's score P1_SCORE_BCD (0x88a2), player 2's score P2_SCORE_BCD (0x88a5), and the top/high
 *   score HIGH_SCORE_BCD (0x88a8). "Packed BCD" means each byte carries two decimal digits (one
 *   per nibble), so a 3-byte counter is a six-digit decimal number. Each counter has a matching
 *   vertical strip of tiles on the display where those six digits are drawn one per row:
 *   P1_SCORE_VRAM (0x8781), P2_SCORE_VRAM (0x8521), and HIGH_SCORE_VRAM (0x8641). This routine is
 *   the "clear the score" operation — it wipes one of the three counters back to zero and
 *   immediately redraws its column so the picture on screen matches the cleared value.
 *
 * ROLE IN THE MACHINE
 *   Run when a score line must start over (a new game blanks a player's score before play begins).
 *   Rather than compute what a zero score looks like, it reuses the ordinary score-column painter
 *   right after zeroing the counter, so the drawn result is guaranteed to agree with the stored
 *   value — a cleared counter always renders as a cleared column.
 *
 * ROM 0x0552-0x059c. Grounding: [seen].
 *
 * WHICH COUNTER (the `sel` selector — the accumulator on entry)
 *   0     -> player 1:   counter P1_SCORE_BCD,   column P1_SCORE_VRAM
 *   1     -> player 2:   counter P2_SCORE_BCD,   column P2_SCORE_VRAM
 *   other -> high score: counter HIGH_SCORE_BCD, column HIGH_SCORE_VRAM
 *
 * HOW THE COLUMN IS DRAWN
 *   The three counter bytes are read most-significant byte first, and each byte is split into its
 *   two packed-BCD digits — high nibble then low nibble — for six digits in all. Each digit is
 *   stamped one tilemap row apart, the write cursor stepping by -0x20 (one row up) after every
 *   digit, starting from the column's base cell. The digits go through the leading-zero-blanking
 *   digit painter renderDigitWithBlanking, threaded a shared "blank budget" of 4: the first four
 *   leading zeros come out as blank tiles instead of a row of 0s, and only once the budget is
 *   spent does a zero print as a real "0". Because the counter was just zeroed every digit is
 *   zero, so the column paints as four blanks followed by two zeros.
 *
 * LIVE-OUT: none returned (memory only) — the selected counter is left at 0 and its six HUD
 *   column tiles are repainted to the cleared-score pattern.
 */
const COUNTER_BYTES = 3; //    a score is a 3-byte packed-BCD counter (six decimal digits)
const BLANK_BUDGET = 4; //     leading zeros suppressed before a real 0 shows
const ROW_STRIDE_UP = -0x20; // one tilemap row up between stacked digits

export function resetBcdCounterAndRepaintColumn(m, sel = m.regs.a) {
  const { mem8 } = m;

  // Choose the counter and its HUD column from the selector: 0 and 1 name the two players, and
  // anything else falls through to the high-score line. The counter base (in work RAM) and the
  // column base (in the tilemap) are picked together so the wipe and the repaint act on the same
  // score.
  const base = sel === 0 ? P1_SCORE_BCD : sel === 1 ? P2_SCORE_BCD : HIGH_SCORE_BCD;
  const dest = sel === 0 ? P1_SCORE_VRAM : sel === 1 ? P2_SCORE_VRAM : HIGH_SCORE_VRAM;

  // Zero the whole 3-byte counter (base, base+1, base+2). This is the actual score reset; the
  // repaint below only mirrors the now-cleared value onto the display.
  mem8[base] = 0;
  mem8[base + 1] = 0;
  mem8[base + 2] = 0;

  // Set up the column walk: the cursor starts at the column's base cell (dest); the blank budget
  // starts full so the field's leading zeros are suppressed; and the source pointer starts at the
  // counter's most-significant byte (base + 2) — the field is painted most-significant first, so
  // the byte pointer walks downward through the counter.
  let cursor = dest;
  let budget = BLANK_BUDGET;
  let src = base + COUNTER_BYTES - 1; // top byte, read downward

  // Walk the three bytes most-significant first, painting each as two digits. `byte >> 4` is the
  // high (tens) nibble and `byte` is the low (units) nibble — the painter masks to the low nibble,
  // so passing the raw byte for the second digit paints its units. Each renderDigitWithBlanking
  // stamps one tile at the cursor, advances the cursor by ROW_STRIDE_UP (one row up), and hands
  // back the advanced cursor plus the remaining blank budget so the next digit continues the same
  // field — the leading-blank run is threaded across all six digits, not restarted per byte.
  for (let i = 0; i < COUNTER_BYTES; i++) {
    const byte = mem8[src];
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_STRIDE_UP, byte >> 4, budget);
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_STRIDE_UP, byte, budget);
    src -= 1; // step down to the next-less-significant counter byte
  }
}
