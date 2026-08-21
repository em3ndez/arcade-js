// SPDX-License-Identifier: GPL-3.0-only
import { loc_6505 } from "../translated/loc_6505.js";
import { loc_6566 } from "../translated/loc_6566.js";
import { loc_6666 } from "../translated/loc_6666.js";
/**
 * loc_64fb — dispatch the fountain record's per-frame state handler.
 *
 * The record's state byte at IX+2 selects one of three handlers (0/1/2). Each is a tail
 * hand-off: no continuation is stacked here, so the handler returns straight to our
 * caller.
 *
 * LIVE-OUT: memory only — the caller reloads its own pointers after the call.
 */
export function loc_64fb(m, rec = m.regs.ix) {
  const { mem8 } = m;
  switch (mem8[rec + 0x02]) {
    case 0:
      return loc_6505(m);
    case 1:
      return loc_6566(m);
    case 2:
      return loc_6666(m);
  }
}
