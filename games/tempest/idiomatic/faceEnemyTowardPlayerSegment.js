// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, PLAYER_SEGMENT, ENEMY_SLOT_FLAGS } from "./names.js";
import { signedSegmentDelta } from "./signedSegmentDelta.js";

// Fetch slot x's target and a shared byte, derive a signed difference, then flip bit6 of
// slot x's flag byte: clear it when the difference's top bit is set, set it otherwise.
export function faceEnemyTowardPlayerSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(ENEMY_SEGMENT + x)];
  const diff = signedSegmentDelta(m, mem8[PLAYER_SEGMENT], y);
  const e = u16(ENEMY_SLOT_FLAGS + x);
  if (diff & 0x80) mem8[e] &= 0xbf; // top bit set -> clear bit6
  else mem8[e] |= 0x40;             // else set bit6
}
