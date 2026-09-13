// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COORD_DISPATCH_SEL, DISPATCH_PTR_LO_TABLE } from "./names.js";
import { loc_96c7, loc_96c8 } from "./loc_96c7.js";
import { loc_96cb } from "./loc_96cb.js";

// Computed-jump dispatch. COORD_DISPATCH_SEL is an even byte index selecting a target from a fixed
// handler set; the chosen handler is tail-called and consumes this routine's own caller's
// return. Before dispatching, A is seated to the low byte of the selected pointer: the two
// Y-only handlers leave A untouched, so that byte is the value the caller reads back.
const TABLE = [null, loc_96c8, loc_96cb, loc_96cb, loc_96c7, loc_96c8, loc_96c7];

export function loc_9683(m, y = m.regs.y) {
  const { mem8 } = m;
  const index = mem8[COORD_DISPATCH_SEL];
  const aSeed = mem8[u16(DISPATCH_PTR_LO_TABLE + index)]; // low pointer byte; A live-out on the Y-only handlers
  const r = TABLE[index >> 1](m, y);
  // 96cb returns [a, advancedY]; the Y-only handlers return the advanced Y scalar (A stays the seed).
  if (Array.isArray(r)) return [(m.regs.a = r[0]), r[1]];
  return [(m.regs.a = aSeed), r];
}
