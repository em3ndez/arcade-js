// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b8b — snap a candidate X to the settled column of its 8-pixel cell, then commit it as
 * Mario's position.
 *
 * One arm of the horizontal snap the tile probe performs, chosen when Mario has no horizontal
 * airborne velocity to speak of. It receives a candidate X — Mario's current one — and aligns it
 * to the column the containing 8-pixel cell settles to, which works out as the cell boundary plus
 * 3. The snapped value then goes straight to the commit, which stores it both as Mario's position
 * and into his sprite record, so the drawn sprite jumps to the new column in the same frame.
 *
 * The commit also raises a two-level unwind, meaning control does not go back to the immediate
 * caller but past it; this routine hands that signal on exactly as it comes.
 *
 * NOT CLAIMED: what makes this arm the right one to take, beyond the velocity test that selects
 * it. The snap itself and the commit are all this file establishes.
 *
 * LIVE-OUT: Mario's X and his sprite record's X, written by the commit; the value the caller two
 * levels up reads; and the unwind signal, passed through.
 */

import { loc_2b91 } from "./loc_2b91.js";

export function loc_2b8b(m) {
  const { regs } = m;

  // The candidate X the probe handed over: Mario's current X.
  const candidateX = regs.a;

  // Snap it to the settled column of its 8-pixel cell: step into the cell below, force the
  // low three bits, then step up. The result is the cell boundary plus 3.
  regs.a = ((candidateX - 8) | 0x07) + 4;

  // Commit the snapped X to Mario's position and sprite record, and pass on the unwind.
  return loc_2b91(m);
}
