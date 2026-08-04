// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawHighScore — repaint the on-screen high-score readout from the HIGH_SCORE counter.
 * ROM 0x05DA.
 *
 * The two-instruction tail shared by the two score tasks that need the record
 * redrawn:
 *   - the score-add task (entry_051c) adds a payload to the player up's score and,
 *     if the new total beats the record, copies it into HIGH_SCORE — then falls
 *     through here to repaint it; and
 *   - the counter-draw task (handler_05c6), for its high-score selector, reaches
 *     the same two instructions.
 * Both point the render source at the high score and hand off to the fixed-column
 * BCD renderer, so the record on screen tracks the stored value.
 *
 * HIGH_SCORE is a 3-byte little-endian packed BCD counter (base 0x60B8; the
 * most-significant pair sits at 0x60BA = HIGH_SCORE + 2). Pointing the source at
 * that most-significant pair makes the renderer walk the three bytes top-down, so
 * the six digits paint in reading order climbing the fixed high-score column
 * (video cell 0x7641). The source register the caller left is a don't-care — this
 * routine overwrites it with HIGH_SCORE + 2 on every entry, which is the whole
 * reason it exists as a shared tail rather than being inlined into each caller.
 *
 * The renderer still takes its source pointer in a register (it has not promoted
 * that live-in to a parameter yet), so this routine loads it exactly where the
 * renderer reads it — the one bit of register marshalling here.
 *
 * NAME: promoted from loc_05da on corroboration — the source is the rated
 * HIGH_SCORE cell and both callers' documented job is maintaining/redrawing the
 * record (the real attract dispatch renders 7650, the machine's default record).
 * The destination column's screen identity is not needed for the name: whatever
 * cell 0x7641 is, this routine draws the high-score VALUE there.
 *
 * Memory-equivalent to the frozen oracle — equivalence-05da.test.js.
 * GATE:     crafted-entry, grounded in the real attract dispatch. Attract reaches
 *           0x05DA (the high-score redraw), so that real state is captured and
 *           replayed; crafted arms then vary the counter digits, a wrong incoming
 *           source register, and a wrong incoming destination cell that attract
 *           does not exercise. Compared over RAM (minus STACK_SCRATCH) + pc + SP +
 *           reproduced registers. Teeth: a twin that keeps the caller's stale
 *           source (renders the wrong counter) and a twin that enters the renderer
 *           in caller-column mode (skips the fixed 0x7641 store).
 * LIVE-OUT: memory-only — the six digit cells painted into video RAM. The caller
 *           reads none of the output registers; they are reproduced identically to
 *           the oracle and compared for free.
 * NAMES:    HIGH_SCORE (0x60B8) from names.js. The destination column 0x7641 is video
 *           RAM (0x7400-0x77FF), owned by the renderer and kept hex there.
 */
import { HIGH_SCORE } from "./names.js";
import { renderBcdColumnFixedCell } from "./renderBcdColumnFixedCell.js"; // ROM 0x0578

export function drawHighScore(m) {
  const { regs } = m;

  // Source := the high score's most-significant pair, so the renderer walks the
  // three packed BCD bytes top-down (six digits, reading order, up the column).
  regs.de = HIGH_SCORE + 2;

  // Fixed-column entry: the renderer hard-wires the destination to the high-score
  // column and paints the digits.
  renderBcdColumnFixedCell(m);
}
