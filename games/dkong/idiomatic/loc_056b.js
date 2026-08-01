// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_056b — pick one of two destination columns from a zero/nonzero selector, then
 * render a 3-byte packed-BCD counter up that column.  ROM 0x056B.
 *
 * A thin front end to the packed-BCD column renderer (renderBcdColumn, 0x057C). It
 * chooses the destination video column from a selector byte the caller hands in:
 *   - selector zero    -> column 0x7781
 *   - selector nonzero -> column 0x7521
 * then joins the shared renderer at its caller-supplied-column entry (0x057C), which
 * paints the six digits of the counter at the source pointer climbing that column,
 * one tilemap row up per digit.
 *
 * Reached two ways, both still the frozen oracle, so the selector and the source
 * pointer arrive in registers — a genuine caller boundary, not promotable to params
 * until those callers are decompiled:
 *   - the score adder (entry_051c) calls it with the selector = the player up now and
 *     the source = that player's just-updated 3-byte score, so player 1's score draws
 *     into one column and player 2's into the other;
 *   - the counter drawer (handler_05c6) reaches it with a task payload as the selector
 *     and the source = one of the on-screen BCD counters.
 *
 * NAME: kept the neutral loc_ — the two-column select-then-render MECHANISM is pinned
 * to the oracle, but the selector's meaning differs between the two callers (player
 * number vs task payload) and both destination cells are unnamed video RAM, so the
 * routine-name evidence bar is not met. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-056b.test.js.
 * GATE:     crafted-entry, grounded in real captured RAM. 0x056B is dispatched during
 *           attract (the demo scores), so real captured dispatches ground the gate;
 *           crafted entries then force BOTH selector arms (zero -> 0x7781, nonzero ->
 *           0x7521) identically on both sides, over a differing-nibble source that
 *           makes the high-then-low digit render observable. Compared over RAM (minus
 *           STACK_SCRATCH) + pc + SP + reproduced registers. Teeth: a twin that swaps
 *           the two columns and a twin that uses the wrong zero-arm column constant.
 * LIVE-OUT: memory-only — the six digit cells written into video RAM by the renderer.
 *           The callers discard the output registers (entry_051c pops DE and reads
 *           none; the renderer's residual A/HL/DE/B/C/IX are dead), so they are
 *           reproduced identically to the oracle and compared only for extra teeth.
 * NAMES:    none from ram.js — the selector and source pointer are caller-supplied and
 *           the two destination cells (0x7781, 0x7521) are video RAM (0x7400-0x77FF),
 *           deliberately unnamed. renderBcdColumn (ROM 0x057C) is direct-called.
 */
import { renderBcdColumn } from "./renderBcdColumn.js"; // ROM 0x057C — caller-column BCD renderer

const COLUMN_IF_ZERO = 0x7781;    // destination column when the selector is zero (video RAM)
const COLUMN_IF_NONZERO = 0x7521; // destination column when the selector is nonzero (video RAM)

export function loc_056b(m) {
  const { regs } = m;

  // The selector arrives in a register from the still-oracle caller. A zero value
  // picks one fixed column; any nonzero value the other.
  const selector = regs.a;
  regs.ix = selector === 0 ? COLUMN_IF_ZERO : COLUMN_IF_NONZERO;

  // Render the source counter (its pointer is the caller's live-in) up the chosen
  // column: six digits, one tilemap row up per digit.
  renderBcdColumn(m);
}
