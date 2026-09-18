// SPDX-License-Identifier: GPL-3.0-only
/**
 * update50mConveyorObjects — the 50m board's per-frame object update: gate on the 50m board (mask
 * 0x02), run the three conveyor-object step drivers, then carry Mario along his conveyor row.
 * ⚠ ORDER MATTERS: each driver publishes the signed X-step its object moves this frame, and the
 * carry consumes those steps, so the drivers must run before the carry. LIVE-OUT: memory-only.
 */

import { boardBitGate } from "./boardBitGate.js";
import { loc_2602 } from "./loc_2602.js";                               // conveyor object 1 driver
import { loc_262f } from "./loc_262f.js";                               // conveyor object 2 driver
import { loc_2679 } from "./loc_2679.js";                               // conveyor object 3 driver
import { carryMarioOnConveyorRow } from "./carryMarioOnConveyorRow.js"; // carry Mario on his row

const BOARD_MASK = 0x02; // bit1 -> the 50m board, the only board this update runs on

export function update50mConveyorObjects(m) {
  if (!boardBitGate(m, BOARD_MASK)) return;

  loc_2602(m);
  loc_262f(m);
  loc_2679(m);
  carryMarioOnConveyorRow(m);
}
