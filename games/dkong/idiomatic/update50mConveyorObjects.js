// SPDX-License-Identifier: GPL-3.0-only
/**
 * update50mConveyorObjects — the 50m board's per-frame object update: gate on the 50m
 * board, then run the three conveyor-object step drivers and carry Mario along his
 * conveyor row.
 *
 * Dispatched once per serviced frame from the board-object cascade. A single board
 * gate with mask 0x02 (bit1 -> the 50m board) opens the update ONLY on the 50m board;
 * on any other board the gate is closed and the whole cascade is skipped — which is
 * why on the 25m board this routine is dispatched constantly but its body never runs.
 * When it does run, it drives the board's object state in the fixed order the mover
 * depends on:
 *
 *   1. Conveyor object 1's reverse-timer / step-direction driver.
 *   2. Conveyor object 2's driver (gated by Mario's vertical position).
 *   3. Conveyor object 3's driver.
 *   4. The carry: read which conveyor row Mario stands on and move his X by that row's
 *      freshly-published step, so he rides the platform.
 *
 * The three drivers MUST run before the carry: each publishes the signed X-step its
 * object moves this frame, and the carry consumes those steps. This routine only
 * sequences the four; every cell it affects lives inside the callees.
 *
 * It sequences, and claims nothing about what the three driven objects are beyond the
 * conveyor reading the carry commits it to.
 *
 * LIVE-OUT: memory-only. The board-gate skip is the caller-skip idiom, modelled as the
 * boolean early return.
 */

import { boardBitGate } from "./boardBitGate.js";
import { loc_2602 } from "./loc_2602.js";                               // conveyor object 1 driver
import { loc_262f } from "./loc_262f.js";                               // conveyor object 2 driver
import { loc_2679 } from "./loc_2679.js";                               // conveyor object 3 driver
import { carryMarioOnConveyorRow } from "./carryMarioOnConveyorRow.js"; // carry Mario on his row

// Board mask: bit1 -> the 50m board, the only board this update runs on.
const BOARD_MASK = 0x02;

export function update50mConveyorObjects(m) {
  const { regs } = m;

  // Board gate: run the object update only on the 50m board. The gate reads the mask
  // from the accumulator; on any other board it closes and the whole cascade is skipped.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  // Update the three conveyor-object step drivers, then carry Mario by the step of whichever
  // row he stands on. Order matters — the carry reads the steps the three drivers publish.
  loc_2602(m);
  loc_262f(m);
  loc_2679(m);
  carryMarioOnConveyorRow(m);
}
