// SPDX-License-Identifier: GPL-3.0-only
import { initRoundState } from "./initRoundState.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { mainLoop } from "./mainLoop.js";

/**
 * loc_200e — the game entry: seed round state, enable interrupts, lay the record field, then run the
 * per-frame main loop forever. A generator so the main loop's vblank yields propagate to the engine.
 */
export function* loc_200e(m) {
  initRoundState(m);
  m.regs.fI = false; // cli — enable the 32V interrupt now that state is seeded
  plotRecordFieldColumns(m);
  yield* mainLoop(m);
}
