// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_a028 } from "./loc_a028.js";
import { SCRIPT_BRANCH_FLAG, ENEMY_SEGMENT, LANE_LIMIT, ENEMY_DEPTH, LANE_TARGET_FLAG, ENEMY_SLOT_DIR, ENEMY_SLOT_FLAGS, FIRE_GATE } from "./names.js";

// Advance slot x toward its column target: seed an empty column to 0xf1, keep the column
// depth as the running minimum (tagging a fresh min), then clamp shallow depths or, past
// the far limit, pick a new column and rewrite the slot's flag/segment fields.
export function loc_9fc4(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SCRIPT_BRANCH_FLAG] = 1;
  const col = mem8[u16(ENEMY_SEGMENT + x)];
  const colAddr = u16(LANE_LIMIT + col);
  if (mem8[colAddr] === 0) mem8[colAddr] = 0xf1;

  const depthAddr = u16(ENEMY_DEPTH + x);
  if (mem8[depthAddr] < mem8[colAddr]) {          // fresh minimum for this column
    mem8[colAddr] = mem8[depthAddr];
    mem8[u16(LANE_TARGET_FLAG + col)] = 0x80;
  }

  const depth = mem8[depthAddr];
  if (depth < 0x20) {                             // too shallow -> flag and clamp
    mem8[u16(ENEMY_SLOT_DIR + x)] |= 0x80;
    mem8[depthAddr] = 0x20;
    return;
  }
  if (depth < 0xf2) return;                       // mid-range -> nothing more

  loc_a028(m, x);                                 // past the far limit -> pick a new column
  mem8[depthAddr] = 0xf0;
  if (mem8[FIRE_GATE] !== 0) return;

  mem8[u16(ENEMY_SLOT_DIR + x)] = (mem8[u16(ENEMY_SLOT_DIR + x)] & 0xfc) | 0x01;
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0xf8) | 0x02;
  mem8[SCRIPT_BRANCH_FLAG] = 0;
}
