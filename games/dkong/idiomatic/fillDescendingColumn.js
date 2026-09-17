// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillDescendingColumn — lay v, v-1, v-2 into three cells at a caller stride: store, step the
 * pointer by the stride, descend the value, three times.
 *
 * LIVE-OUT: the three memory cells, plus the trailing registers — value 3 lower, pointer advanced
 * three strides, spent loop counter.
 */
export function fillDescendingColumn(m, hl = m.regs.hl, a = m.regs.a, de = m.regs.de) {
  const { regs, mem8 } = m;

  let addr = hl & 0xffff;
  let val = a & 0xff;
  const stride = de & 0xffff;

  for (let pass = 0; pass < 3; pass++) {
    mem8[addr] = val;
    addr = (addr + stride) & 0xffff;
    val = (val - 1) & 0xff;
  }

  regs.a = val;
  regs.hl = addr;
  regs.b = 0;
}
