// SPDX-License-Identifier: GPL-3.0-only
/**
 * update50mConveyorObjects — the 50m board's per-frame object update: gate on the 50m board,
 * then run the three conveyor-object step drivers and carry Mario along his conveyor row.  ROM 0x25F2.
 *
 * Dispatched once per serviced frame from the board-object cascade (`call 0x25F2`). A single
 * `rst 0x30` board gate with mask 0x02 (bit1 -> the 50m board) opens the update ONLY on the
 * 50m board; on any other board the gate is closed and the whole cascade is skipped — which
 * is why in 25m attract this routine is dispatched constantly but its body never runs. When
 * it does run, it drives the board's object state in the fixed order the mover depends on:
 *
 *   1. loc_2602 — advance conveyor object 1's reverse-timer / step-direction driver.
 *   2. loc_262f — conveyor object 2's driver (gated by Mario's vertical position).
 *   3. loc_2679 — conveyor object 3's driver.
 *   4. carryMarioOnConveyorRow — read which conveyor row Mario stands on and carry his X by
 *      that row's freshly-published step, so he rides the platform.
 *
 * The three drivers MUST run before the carry: each publishes the signed X-step its object
 * moves this frame (into the M50_OBJ*_STEP shadows), and the carry consumes those steps. This
 * routine only sequences the four; every cell it affects lives inside the callees.
 *
 * NAME: promoted (understanding pass 6, proposer!=confirmer). The purpose is corroborated —
 * the gate selects the 50m board (mask 0x02 -> BOARD 2; mechanisms.md board 2 = 50m conveyors /
 * pie factory), the drivers work the named M50_OBJ* 50m cells, and the grounded tail
 * carryMarioOnConveyorRow commits the family to the conveyor reading. This orchestrator only
 * SEQUENCES its callees; the per-object drivers (loc_2602/262f/2679) stay neutral loc_ under the
 * M50 "which on-screen object" sprite-record caution — the name does not over-reach to them.
 *
 * Memory-equivalent to the frozen oracle — equivalence-25f2.test.js.
 * GATE:     captured + crafted. 0x25F2 is dispatched every board-object pass, so real attract
 *           dispatches (all on the 25m board) cover the gate-CLOSED arm — the body skipped, no
 *           object RAM touched. The gate-OPEN 50m body is unreachable in attract, so it is
 *           crafted on a real base with BOARD poked to 2 and swept over FRAME x Mario Y-band x
 *           prior-X x reverse-timer config, so the whole cascade (both driver parities, the
 *           32nd-frame sprite advances, each timer underflow+reverse, every conveyor row and
 *           both loc_262f arms) runs and, through the carry, moves MARIO_X. The dropped
 *           push16/ret bracket's dead STACK_SCRATCH is excluded from the RAM diff.
 * LIVE-OUT: memory-only. The caller's next act is another cascade `call`, reading no register
 *           or flag this routine leaves; the board-gate skip is the caller-skip idiom modelled
 *           as the boolean early return.
 * NAMES:    boardBitGate (ROM 0x0030, reads BOARD 0x6227 + the mask in regs.a). The four body
 *           callees own every cell they touch, so this routine names none of its own.
 */

import { boardBitGate } from "./boardBitGate.js";                       // ROM 0x0030 (rst 0x30)
import { loc_2602 } from "./loc_2602.js";                               // ROM 0x2602 — conveyor object 1 driver
import { loc_262f } from "./loc_262f.js";                               // ROM 0x262F — conveyor object 2 driver
import { loc_2679 } from "./loc_2679.js";                               // ROM 0x2679 — conveyor object 3 driver
import { carryMarioOnConveyorRow } from "./carryMarioOnConveyorRow.js"; // ROM 0x2AD3 — carry Mario on his row

// rst-0x30 board mask: bit1 -> the 50m board, the only board this update runs on.
const BOARD_MASK = 0x02;

export function update50mConveyorObjects(m) {
  const { regs } = m;

  // Board gate: run the object update only on the 50m board. boardBitGate reads the mask from
  // regs.a; on any other board it closes and the whole cascade is skipped.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  // Update the three conveyor-object step drivers, then carry Mario by the step of whichever
  // row he stands on. Order matters — the carry reads the steps the three drivers publish.
  loc_2602(m);
  loc_262f(m);
  loc_2679(m);
  carryMarioOnConveyorRow(m);
}
