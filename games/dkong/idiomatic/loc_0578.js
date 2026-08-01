// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0578 — draw a packed 3-byte BCD counter as six digits up a fixed video column.  ROM 0x0578.
 *
 * The fixed-destination entry into the packed-BCD renderer. The caller hands a source
 * pointer (the three packed bytes, two BCD/hex digits each); this routine hard-wires the
 * destination to the video cell 0x7641 and paints the six digits climbing that column,
 * one tilemap row up per digit. It is the same ROM code as renderBcdColumn (0x057c)
 * entered one instruction EARLIER — the only difference is that this entry fixes the
 * destination column itself, whereas renderBcdColumn takes the destination from the
 * caller. draw_056b reaches this code the caller-supplied way (entering at 0x057c after
 * choosing its own column), which is why the second entry mode below skips the fixed cell.
 *
 * The prologue fixes the destination and the DK-standard render parameters, then falls
 * into the shared expansion loop expandBcdDigits (0x0583):
 *
 *   - the fixed destination column 0x7641 is loaded, UNLESS the caller already chose a
 *     column and jumped in past this store (enteredAt057C);
 *   - the source pointer (arriving as the live-in) is moved into place; the value it
 *     displaces is immediately overwritten and discarded;
 *   - the per-digit stride is set to -0x20 — back one tilemap row, so successive digits
 *     climb the column;
 *   - the byte count is set to 3 source bytes (→ 6 digits);
 *   - expandBcdDigits then emits, per source byte, the HIGH nibble then the LOW, walking
 *     the source pointer backwards (so descending source bytes render into ascending
 *     display cells) and stepping the destination by the stride through
 *     storeDigitAndAdvance (0x0593).
 *
 * [guess] The fixed cell 0x7641 is a score/high-score column: attract dispatches this
 * entry with the source pointing into the 0x60b4/0x60ba counter area, and the sibling
 * renderers call 0x7641 "the score column". Purpose left to grounding; mechanism is firm.
 *
 * Reached by: tail_05da (default entry, fixed column) and draw_056b (enteredAt057C=true,
 * the caller's own column). Calls only expandBcdDigits (which owns the loop and store).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0578.test.js.
 * GATE:     crafted-entry, grounded in real captured RAM. Attract dispatches 0x0578 in
 *           BOTH modes (default: source 0x60ba, column forced to 0x7641; caller-column:
 *           IX=0x7781 from draw_056b) — those real entries are captured and replayed, and
 *           the shared loop 0x0583 (B=3, IX=0x7641/0x7781) grounds extra reconstructed
 *           entries. Crafted arms cover the counts/wraps attract does not vary. Compared
 *           over RAM (minus STACK_SCRATCH) + pc + SP + reproduced registers. Teeth: a twin
 *           that omits the fixed-column store (renders to the caller's stale cell) and a
 *           twin with the wrong stride magnitude.
 * LIVE-OUT: memory-only — the six digit cells written into video RAM through 0x0593. The
 *           caller reads none of the output registers, so the reproduced registers
 *           (source-3, stride, count, destination cursor, last masked nibble) are dead to
 *           it; they are reproduced identically to the oracle and compared for free.
 * NAMES:    none from ram.js — the source pointer and destination cell are not fixed game
 *           RAM this routine names; 0x7641 is a video-RAM tile cell (0x7400-0x77FF, kept
 *           hex, deliberately unnamed) and the stride/count are ROM constants.
 */
import { expandBcdDigits } from "./expandBcdDigits.js"; // ROM 0x0583

const ROW_STEP = 0xffe0; // -0x20: back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // count := 3 source bytes (6 digits); low byte 4 is a dead marker

export function loc_0578(m, enteredAt057C = false) {
  const { regs } = m;

  if (!enteredAt057C) {
    regs.ix = 0x7641; // fixed destination column (video RAM 0x7400-0x77FF; no ram.js name)
  }
  regs.exDeHl(); // source pointer arrives as the live-in; move it into place, discard the displaced value
  regs.de = ROW_STEP; // per-digit stride -0x20 (up one tilemap row)
  regs.bc = BYTE_COUNT; // 3 source bytes → 6 digits (low byte dead)

  expandBcdDigits(m); // shared BCD-expansion loop (0x0583): six digits up the column
}
