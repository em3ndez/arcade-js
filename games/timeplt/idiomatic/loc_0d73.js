// SPDX-License-Identifier: GPL-3.0-only
/** loc_0d73 — paint a six-digit field from three packed bytes, stepping the pointer BACK through
 * them a byte at a time while the cursor runs on a cell at a time. The first four digits go
 * through the suppressing painter and share one flag, cleared here, so the field's leading zeros
 * are decided across all four rather than pair by pair; the last two are painted plainly, so no
 * flag can blank them. The colour, the first cell and the byte to start from all arrive from the
 * caller. LIVE-OUT: the cells painted, the cursor six cells on, and the pointer two bytes back. */

import { u16 } from "../../../core/int.js";
import { loc_0d81 } from "./loc_0d81.js";
import { loc_0da0 } from "./loc_0da0.js";

export function loc_0d73(m) {
  const { regs } = m;
  regs.b = 0;
  loc_0da0(m);
  regs.hl = u16(regs.hl - 1);
  loc_0da0(m);
  regs.hl = u16(regs.hl - 1);
  loc_0d81(m);
}
