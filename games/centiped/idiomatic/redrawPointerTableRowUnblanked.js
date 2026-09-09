// SPDX-License-Identifier: GPL-3.0-only
import { loc_8c } from "./names.js";
import { rewritePointerTableRowFromStart } from "./writePointerTableRow.js";

/**
 * redrawPointerTableRowUnblanked -- re-emit the current screen-layout row so it draws UNBLANKED.
 *
 * ROM 0x2XXX (screen-layout / pointer-table row drawing). Grounding: [code] -- read from the routine;
 * $8c is a behavioural placeholder cell.
 *
 * ROLE IN THE MACHINE. The game draws rows of its screen layout (status rows, banners) from ROM
 * "descriptor" records through a shared emit loop in writePointerTableRow.js. That loop reads the sign
 * cell $8c (loc_8c) as a BLANK-OUT flag: when $8c is flagged negative the loop forces every tile to a
 * blank, which is how a row gets erased or drawn dark. This tiny wrapper is the "draw it for real, lit
 * up" entry point: it clears $8c so the blank-out flag is off, then re-enters the shared row emitter at
 * descriptor offset 0 (rewritePointerTableRowFromStart with re-entry index 0) to redraw the current row
 * from its first descriptor byte. The current descriptor is kept -- only the blank flag is reset.
 *
 * LIVE-OUT: $8c cleared to 0 (unblanked), and the current pointer-table row re-emitted to the screen;
 * returns whatever rewritePointerTableRowFromStart returns.
 */
export function redrawPointerTableRowUnblanked(m) {
  // Clear the blank/sign cell so the shared emit loop does NOT force the row to blanks.
  m.mem8[loc_8c] = 0;
  // Re-enter the shared row emitter at descriptor offset 0 -- redraw the current row from its start.
  return rewritePointerTableRowFromStart(m, 0);
}
