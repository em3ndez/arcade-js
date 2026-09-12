// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_28a, loc_2b9, loc_b61e } from "./names.js";
import { loc_bcfd } from "./loc_bcfd.js";

// Pick a jump-mode byte by the slot's low 2 mode bits, pair it with the slot's target, and emit.
export function loc_b60f(m, x = m.regs.x) {
  const { mem8 } = m;
  const mode = mem8[u16(loc_28a + x)] & 0x03;
  return loc_bcfd(m, mem8[u16(loc_b61e + mode)], mem8[u16(loc_2b9 + x)]);
}
