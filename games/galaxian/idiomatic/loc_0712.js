// SPDX-License-Identifier: GPL-3.0-only
// Stamp a marker into the counter cell -- 4 when the mode bit is set, 14 when it is clear -- then
// re-arm the sequence dwell timer.
import { reloadSequenceDwellTimer } from "./reloadSequenceDwellTimer.js";
import { loc_4006 } from "./names.js";

export function loc_0712(m, counter = m.regs.hl) {
  m.mem8[counter] = (m.mem8[loc_4006] & 1) ? 4 : 14;
  reloadSequenceDwellTimer(m);
}
