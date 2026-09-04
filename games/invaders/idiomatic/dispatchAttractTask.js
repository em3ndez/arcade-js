// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS } from "./names.js";
import { runAttractObjectTail } from "./runAttractObjectTail.js";
import { walkAttractObjectTable } from "./walkAttractObjectTable.js";
import { stepAnimationFrame } from "./stepAnimationFrame.js";

// Attract-mode ISR task dispatch: the low three TASK_FLAGS bits queue at most one task, taken in
// priority order -- bit0 re-runs the vblank in-game record tail, bit1 steps one scripted title-screen
// animation frame, bit2 walks the attract-demo object table. No bit set is a no-op.
export function dispatchAttractTask(m) {
  const flags = m.mem8[TASK_FLAGS];
  if (flags & 0x01) return runAttractObjectTail(m);
  if (flags & 0x02) return stepAnimationFrame(m);
  if (flags & 0x04) return walkAttractObjectTable(m);
}
