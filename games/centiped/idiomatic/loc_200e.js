// SPDX-License-Identifier: GPL-3.0-only
import { initRoundState } from "./initRoundState.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { mainLoop } from "./mainLoop.js";

/**
 * loc_200e — the game entry: seed round state, lay the record field, then run the per-frame main loop
 * forever. A generator so the main loop's vblank yields propagate to the engine. (The cli here is
 * vestigial in the idiomatic layer -- the engine fires the 32V IRQ as a direct call, unmasked.)
 */
export function* loc_200e(m) {
  initRoundState(m);
  plotRecordFieldColumns(m);
  yield* mainLoop(m);
}
