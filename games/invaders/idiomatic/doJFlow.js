// SPDX-License-Identifier: GPL-3.0-only
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { loc_0817 } from "./loc_0817.js";

// Extra-life continuation: take a ship from the reserve readout, then re-enter the field-arm tail without
// reloading the saved field. Generator; memory + IO.
export function* doJFlow(m) {
  decrementShipsAndDrawReadout(m);
  yield* loc_0817(m);
}
