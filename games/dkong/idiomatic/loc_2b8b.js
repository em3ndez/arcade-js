// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b8b — snap a candidate X to the settled column of its 8-pixel cell (cell boundary + 3),
 * then commit it as Mario's position. One arm of the tile probe's horizontal snap, chosen when
 * Mario has no horizontal airborne velocity. The commit stores the snapped X as both Mario's
 * position and his sprite record, and raises a two-level unwind that this routine passes on.
 *
 * LIVE-OUT: Mario's X and his sprite record's X, written by the commit; the value the caller two
 * levels up reads; and the unwind signal, passed through.
 */

import { loc_2b91 } from "./loc_2b91.js";

export function loc_2b8b(m, candidateX = m.regs.a) {
  const { regs } = m;

  regs.a = ((candidateX - 8) | 0x07) + 4;

  return loc_2b91(m);
}
