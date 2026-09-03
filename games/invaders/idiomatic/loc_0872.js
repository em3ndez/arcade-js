// SPDX-License-Identifier: GPL-3.0-only
import { restorePlayer1Shields } from "./restorePlayer1Shields.js";
import { loc_0814 } from "./loc_0814.js";

// Player-1 shield-restore arm of the preamble: restore this player's shields, then join the field-arm
// tail. Generator; memory + IO.
export function* loc_0872(m) {
  restorePlayer1Shields(m);
  yield* loc_0814(m);
}
