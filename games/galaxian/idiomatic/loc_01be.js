// SPDX-License-Identifier: GPL-3.0-only
// Sub-state entry: arm the one-frame dwell flag, then tick the prescaled sequence timer.
import { tickPrescaledSequenceTimer } from "./tickPrescaledSequenceTimer.js";
import { loc_4019 } from "./names.js";

export function loc_01be(m) {
  m.mem8[loc_4019] = 1; // arm the dwell flag
  tickPrescaledSequenceTimer(m);
}
