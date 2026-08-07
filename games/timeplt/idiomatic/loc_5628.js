// SPDX-License-Identifier: GPL-3.0-only
/** loc_5628 — request a sound with no permission test at all: the code is queued whether or not
 * a game is being played. LIVE-OUT: memory. */

import { loc_562a } from "./loc_562a.js";

export function loc_5628(m, command = m.regs.a) {
  loc_562a(m, command);
}
