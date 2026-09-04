// SPDX-License-Identifier: GPL-3.0-only
import { drawBottomLine } from "./drawBottomLine.js";
import { restorePlayer2Shields } from "./restorePlayer2Shields.js";
import { loc_0872 } from "./loc_0872.js";
import { enterRoundWithFieldReload } from "./enterRoundWithFieldReload.js";
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// Shield/field preamble: repaint the bottom line, then by the active player's select bit restore this
// player's shields into the field before falling into the field-arm tail. Bit0 set takes the player-1
// restore path; bit0 clear restores player-2 here and continues. Generator; memory + IO.
export function* loc_0804(m) {
  drawBottomLine(m);
  if (m.mem8[ACTIVE_PLAYER_PAGE] & 1) {
    yield* loc_0872(m);
    return;
  }
  restorePlayer2Shields(m);
  drawBottomLine(m);
  yield* enterRoundWithFieldReload(m);
}
