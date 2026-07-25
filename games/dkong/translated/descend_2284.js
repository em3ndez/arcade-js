// SPDX-License-Identifier: GPL-3.0-only

/**
 * descend_2284  (ROM 0x2284–0x2289) — loc_2259's Y-descend: Y++ / call 0x3FC0 / Y++.
 */
export function descend_2284(m) {
  const { regs, mem } = m;
  regs.hl = 0x6205;
  m.step(0x2284, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2285, 11); // Y++
  m.push16(0x2288); m.step(0x3fc0, 17); m.call(0x3fc0);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2289, 11); // Y++
  m.ret(10);
}
