// SPDX-License-Identifier: GPL-3.0-only
/** sendSoundCommand — hand one byte to the audio processor and knock on its door: the byte goes into the
 * one-byte latch that processor reads, then a second latch is driven high and back low, the edge
 * that makes it look. Between the two edges nothing whatever happens, so that stretch contributes
 * pulse WIDTH alone. LIVE-OUT: both latches, plus the zero left in the accumulator. */

import { loc_c000, loc_c304 } from "./names.js";

/** Where in the instruction the write bus cycle lands; a recorder of hardware writes needs it. */
const WRITE_BUS_CYCLE = 10;

export function sendSoundCommand(m, command = m.regs.a) {
  const { regs, mem } = m;
  mem.write8(loc_c000, command, WRITE_BUS_CYCLE);
  mem.write8(loc_c304, 1, WRITE_BUS_CYCLE);
  mem.write8(loc_c304, 0, WRITE_BUS_CYCLE);
  regs.a = 0;
}
