// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, PLAYER_SEGMENT, ENEMY_SLOT_FLAGS } from "./names.js";
import { loc_a7a6 } from "./loc_a7a6.js";

// Fetch slot x's target and a shared byte, derive a signed difference, then flip bit6 of
// slot x's flag byte: clear it when the difference's top bit is set, set it otherwise.
export function loc_9d67(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(ENEMY_SEGMENT + x)];
  const diff = loc_a7a6(m, mem8[PLAYER_SEGMENT], y);
  const e = u16(ENEMY_SLOT_FLAGS + x);
  if (diff & 0x80) mem8[e] &= 0xbf; // top bit set -> clear bit6
  else mem8[e] |= 0x40;             // else set bit6
}
