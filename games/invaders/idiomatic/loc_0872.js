// SPDX-License-Identifier: GPL-3.0-only
import { restorePlayer1Shields } from "./restorePlayer1Shields.js";
import { enterRoundWithFieldReload } from "./enterRoundWithFieldReload.js";

// Player-1 shield-restore arm of the preamble: restore this player's shields, then join the field-arm
// tail. Generator; memory + IO.
export function* loc_0872(m) {
  restorePlayer1Shields(m);
  yield* enterRoundWithFieldReload(m);
}
