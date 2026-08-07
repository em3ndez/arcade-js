// SPDX-License-Identifier: GPL-3.0-only
/** loc_560c — request a sound only while a game is in progress. One permission cell decides: set,
 * and the code joins the pending-sound queue; clear, and the request is dropped silently and
 * completely, leaving no trace for a later frame to pick up. LIVE-OUT: memory. */

import { loc_562a } from "./loc_562a.js";
import { PLAY_ACTIVE } from "./names.js";

export function loc_560c(m, command = m.regs.a) {
  if (m.mem8[PLAY_ACTIVE] === 0) return;
  loc_562a(m, command);
}
