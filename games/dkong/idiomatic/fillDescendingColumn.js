// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillDescendingColumn — lay v, v-1, v-2 into three cells at a caller stride: store, step the
 * pointer by the stride, descend the value, three times.
 *
 * LIVE-OUT: the three memory cells, plus the trailing registers — value 3 lower, pointer advanced
 * three strides, spent loop counter.
 */
import { u16 } from "../../../core/int.js";

export function fillDescendingColumn(m, hl = m.regs.hl, a = m.regs.a, de = m.regs.de) {
  const { mem8 } = m;

  let addr = u16(hl);
  let val = a & 0xff;
  const stride = u16(de);

  for (let pass = 0; pass < 3; pass++) {
    mem8[addr] = val;
    addr = u16(addr + stride);
    val = (val - 1) & 0xff;
  }

  return [m.regs.a = val, m.regs.hl = addr, m.regs.b = 0];
}
