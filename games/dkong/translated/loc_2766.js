// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2766  (ROM 0x2766–0x276E) — reset: 0x6398=0, 0x6221=1.
 */
export function loc_2766(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x2767, 4);
  mem.write8(0x6398, regs.a);
  m.step(0x276a, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x276b, 4);
  mem.write8(0x6221, regs.a);
  m.step(0x276e, 13);
  m.ret(10);
}
