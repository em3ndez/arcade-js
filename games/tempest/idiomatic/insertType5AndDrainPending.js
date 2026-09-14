// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_FINE_ANGLE } from "./names.js";
import { insertObjectAndSignalReady } from "./primeTopPriorityObject.js";

// Insert an object tagged 5 through the shared tail, then step the pending counter down one.
export function insertType5AndDrainPending(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  insertObjectAndSignalReady(m, 0x05, x, y);
  mem8[PLAYER_FINE_ANGLE] = mem8[PLAYER_FINE_ANGLE] - 1;
}
