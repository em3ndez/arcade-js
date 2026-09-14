// SPDX-License-Identifier: GPL-3.0-only
import { dispatchCoordListSetup } from "./dispatchCoordListSetup.js";

// Copies X into the dispatch index and runs the computed jump, tail-returning the
// selected list-setup entry's result to this routine's own caller.
export function dispatchListSetupByColumn(m, x = m.regs.x) {
  return dispatchCoordListSetup(m, x);
}
