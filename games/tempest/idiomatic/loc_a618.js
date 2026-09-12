// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_0, loc_3, loc_37, loc_10d, loc_10e, loc_283 } from "./names.js";
import { loc_a6a9 } from "./loc_a6a9.js";
import { loc_a721 } from "./loc_a721.js";
import { loc_a65b } from "./loc_a65b.js";

// Per-frame enemy-slot walk: seed the frame-active flag from the spawn countdown, then walk
// the 16 slots high-to-low. A live slot integrates and steps its motion axes and marks the
// frame active; a free slot spawns a new enemy while the countdown is nonzero. The step leaves
// its last axis whole in a register a later spawn stamps into memory, so the last live slot's
// returned value is carried forward to each subsequent spawn. After the walk, on even frames
// tick the countdown toward zero; if nothing was live or spawned, raise the mode-request byte.
export function loc_a618(m, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_10d] = mem8[loc_10e];

  for (let x = 0x0f; x >= 0; x--) {
    if (mem8[u16(loc_283 + x)] !== 0) {
      // Live slot: integrate then step; only the step's return threads onward.
      loc_a6a9(m, x);
      y = loc_a721(m, x);
      mem8[loc_10d] = 0xff;
    } else if (mem8[loc_10e] !== 0) {
      // Free slot with budget: spawn, consuming the threaded register.
      loc_a65b(m, x, y);
    }
  }
  mem8[loc_37] = 0xff; // slot counter settles here after the walk

  // Even frames tick the spawn countdown toward zero.
  if ((mem8[loc_3] & 0x01) === 0 && mem8[loc_10e] !== 0) {
    mem8[loc_10e] = u8(mem8[loc_10e] - 1);
  }
  // Nothing live or spawned -> raise the mode-request byte.
  if (mem8[loc_10d] === 0) mem8[loc_0] = 0x12;
}
