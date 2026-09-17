// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheSlotSweep — close one TURN of a slot sweep and start the next while turns remain. Both cursors
 * step at once, each by its own stride — sixteen bytes for the record, two for the sprite entry —
 * which is what keeps the pair addressing one slot. The counter comes down by one and is the only
 * thing that ends the sweep: at zero the sweep is over and this entry ends, otherwise control goes
 * back to the head of the turn and does not return here. The record stride is left behind in the
 * wide scratch pair too. LIVE-OUT: memory, the two cursors, the counter and that scratch pair. */

import { loc_40ea } from "./names.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function closeOneTurnOfTheSlotSweep(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix += RECORD_STRIDE;
  regs.iy += ENTRY_STRIDE;
  regs.b -= 1;

  if (regs.b === 0) return;
  return m.call(loc_40ea);
}
