// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TUBE_GEOM_FLAG, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT } from "./names.js";

// Per-slot bit6 keeper, only while the global gate is on. When bit6 of the slot flag is
// set, clear it once the slot depth reaches 0x0e; when bit6 is clear, set it only while
// the depth is 0. Slot chosen by x.
export function keepClimberFlipBitByDepth(m, x = m.regs.x) {
  const { mem8 } = m;
  if (mem8[TUBE_GEOM_FLAG] === 0) return;
  const flag = u16(ENEMY_SLOT_FLAGS + x);
  const depth = mem8[u16(ENEMY_SEGMENT + x)];
  if (mem8[flag] & 0x40) {
    if (depth >= 0x0e) mem8[flag] = mem8[flag] & 0xbf;
  } else {
    if (depth === 0) mem8[flag] = mem8[flag] | 0x40;
  }
}
