// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  WORK_PTR_LO, WORK_PTR_HI, POINTER_PARITY,
  DRAW_BASE_PTR_LO, DRAW_BASE_PTR_HI, DRAW_PTR_EVEN_LO, DRAW_PTR_EVEN_HI, DRAW_PTR_ODD_LO, DRAW_PTR_ODD_HI,
} from "./names.js";
import { emitRecordBodyC0 } from "./emitRecordBodyC0.js";

// Emit one header record, toggle this slot's parity flag, then write the pointer target
// with the word chosen by the freshly toggled parity.
export function closeLayerPointer(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  emitRecordBodyC0(m);
  const slot = a;
  const idx = (a << 1) & 0xff;
  mem8[WORK_PTR_LO] = mem8[u16(DRAW_BASE_PTR_LO + idx)];
  mem8[WORK_PTR_HI] = mem8[u16(DRAW_BASE_PTR_HI + idx)];
  const parity = mem8[u16(POINTER_PARITY + slot)] ^ 0x01;
  mem8[u16(POINTER_PARITY + slot)] = parity;
  let lo, hi;
  if (parity !== 0) {
    lo = mem8[u16(DRAW_PTR_ODD_LO + idx)];
    hi = mem8[u16(DRAW_PTR_ODD_HI + idx)];
  } else {
    lo = mem8[u16(DRAW_PTR_EVEN_LO + idx)];
    hi = mem8[u16(DRAW_PTR_EVEN_HI + idx)];
  }
  const dst = mem16[WORK_PTR_LO];
  mem8[u16(dst)] = lo;
  mem8[u16(dst + 1)] = hi;
}
