// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_FINE_ANGLE, TARGET_SEG } from "./names.js";
import { primeTopPriorityObject } from "./primeTopPriorityObject.js";

// Prime the top object only when the live byte matches slot x's target and the
// ready flag is not already set high; then latch the flag.
export function primeTopObjectOnTargetMatch(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[PLAYER_SEGMENT] !== mem8[u16(TARGET_SEG + x)]) return;
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;
  primeTopPriorityObject(m, x, y);
  mem8[PLAYER_FINE_ANGLE] = 0x81;
}
