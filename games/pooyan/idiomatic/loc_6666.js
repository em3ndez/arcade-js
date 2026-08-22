// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_667c } from "./loc_667c.js";
import { loc_66a1 } from "./loc_66a1.js";
import { HUNTER_TABLE_BASE } from "./names.js";
/**
 * loc_6666 — advance then animate the three hunter records.
 *
 * Walks three actor records backward from the incoming pointer (one record, 0x18 bytes, per
 * step), advancing each idle record's position. Then runs the countdown-gated blink animation
 * over the hunter table.
 *
 * LIVE-OUT: memory only — nothing is read back from a register.
 */

const RECORD_COUNT = 3; //     records advanced per pass
const RECORD_STRIDE = -0x18; // one actor record backward per step

export function loc_6666(m, ix = m.regs.ix) {
  let record = ix;
  for (let i = 0; i < RECORD_COUNT; i++) {
    loc_667c(m, record);
    record = u16(record + RECORD_STRIDE);
  }
  loc_66a1(m, HUNTER_TABLE_BASE);
}
