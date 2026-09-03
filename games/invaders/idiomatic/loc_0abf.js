// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS } from "./names.js";
import { loc_0abb } from "./loc_0abb.js";
import { loc_0aab } from "./loc_0aab.js";
import { stepAnimationFrame } from "./stepAnimationFrame.js";

// Attract-mode ISR task dispatch: the low three TASK_FLAGS bits queue at most one task, taken in
// priority order -- bit0 re-runs the vblank in-game record tail, bit1 steps one scripted title-screen
// animation frame, bit2 walks the attract-demo object table. No bit set is a no-op.
export function loc_0abf(m) {
  const flags = m.mem8[TASK_FLAGS];
  if (flags & 0x01) return loc_0abb(m);
  if (flags & 0x02) return stepAnimationFrame(m);
  if (flags & 0x04) return loc_0aab(m);
}
