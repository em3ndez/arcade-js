// SPDX-License-Identifier: GPL-3.0-only
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { enterRoundWithoutFieldReload } from "./enterRoundWithoutFieldReload.js";

// Extra-life continuation: take a ship from the reserve readout, then re-enter the field-arm tail without
// reloading the saved field. Generator; memory + IO.
export function* doJFlow(m) {
  decrementShipsAndDrawReadout(m);
  yield* enterRoundWithoutFieldReload(m);
}
