// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_056b — pick one of two destination columns from a zero/nonzero selector, then
 * render a 3-byte packed-BCD counter up that column.
 *
 * A thin front end to the shared packed-BCD column renderer. It chooses the
 * destination video column from a selector byte the caller hands in:
 *   - selector zero    -> one fixed column
 *   - selector nonzero -> the other
 * then joins the renderer at its caller-supplied-column entry, which paints the six
 * digits of the counter at the source pointer climbing that column, one tilemap row up
 * per digit.
 *
 * Reached two ways, and both hand the selector and the source pointer over in
 * registers rather than as arguments:
 *   - the score adder calls it with the selector = the player up now and the source =
 *     that player's just-updated 3-byte score, so player 1's score draws into one
 *     column and player 2's into the other;
 *   - the counter drawer reaches it with a task payload as the selector and the source
 *     = one of the on-screen BCD counters.
 *
 * The two-column select-then-render MECHANISM is pinned, but the selector's MEANING
 * differs between those two callers (player number vs task payload) and both
 * destination cells are unnamed video RAM, so no English name is claimed for it.
 *
 * LIVE-OUT: memory-only — the six digit cells the renderer writes into video RAM.
 */
import { renderBcdColumn } from "./renderBcdColumn.js"; // caller-column BCD renderer

const COLUMN_IF_ZERO = 0x7781;    // destination column when the selector is zero (video RAM)
const COLUMN_IF_NONZERO = 0x7521; // destination column when the selector is nonzero (video RAM)

export function loc_056b(m) {
  const { regs } = m;

  // The selector arrives in a register from the caller. A zero value picks one fixed
  // column; any nonzero value the other.
  const selector = regs.a;
  regs.ix = selector === 0 ? COLUMN_IF_ZERO : COLUMN_IF_NONZERO;

  // Render the source counter (its pointer is the caller's live-in) up the chosen
  // column: six digits, one tilemap row up per digit.
  renderBcdColumn(m);
}
