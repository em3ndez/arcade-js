// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheSlotSweep — close one TURN of a slot sweep and run the next while turns remain. Both cursors
 * step at once, each by its own stride — sixteen bytes for the record, two for the sprite entry —
 * which is what keeps the pair addressing one slot. The counter comes down by one inside a byte and
 * is the only thing that ends the sweep: at zero the sweep is over and this entry ends, otherwise
 * it runs the next turn, which closes itself here in turn, so this entry ends only when the whole
 * sweep has. The stepped cursors and counter are HANDED to the next turn as its arguments. The next
 * turn is `nextTurn`, the sweep's own turn body unless a gate stands a recorder in for it.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { serviceSlotByMarkerThenCloseSweepTurn } from "./serviceSlotByMarkerThenCloseSweepTurn.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function closeOneTurnOfTheSlotSweep(m, ix = m.regs.ix, iy = m.regs.iy, b = m.regs.b, nextTurn = serviceSlotByMarkerThenCloseSweepTurn) {
  const left = u8(b - 1);
  if (left === 0) return;
  return nextTurn(m, u16(ix + RECORD_STRIDE), u16(iy + ENTRY_STRIDE), left);
}
