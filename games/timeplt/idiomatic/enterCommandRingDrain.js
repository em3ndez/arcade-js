// SPDX-License-Identifier: GPL-3.0-only
/** enterCommandRingDrain — tail transfer into the foreground command-ring loop; hands control to the ring drain and never comes back. LIVE-OUT: whatever the drain leaves. */

import { runCommandRingDrainLoop_ADDR } from "./names.js";

export function enterCommandRingDrain(m) {
  return m.call(runCommandRingDrainLoop_ADDR);
}
