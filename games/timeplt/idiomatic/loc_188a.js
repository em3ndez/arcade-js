// SPDX-License-Identifier: GPL-3.0-only
/** loc_188a — the copyright screen's await-start step: redraw the fixed caption, flash its line,
 * then dispatch on the start buttons — bit 4 (two-player, tested first) or bit 3 (one-player), and
 * with neither held return. LIVE-OUT: what the chosen start leaves, else memory only. */

import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { startTwoPlayerGame } from "./startTwoPlayerGame.js";
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { IN0_MIRROR } from "./names.js";

const TWO_PLAYER_START = 0x10;
const ONE_PLAYER_START = 0x08;

export function loc_188a(m) {
  stampCopyrightStrip(m);
  flashCopyrightLine(m);

  const buttons = m.mem8[IN0_MIRROR];
  if (buttons & TWO_PLAYER_START) return startTwoPlayerGame(m);
  if (buttons & ONE_PLAYER_START) return startOnePlayerGame(m);
}
