// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_168a  (ROM 0x168A–0x16A0) — 0x1644 idx: rst-0x18 gate, copy 0x388C, 0x690C=0x66, clear 0x6924/2C/62AF, then tail_1662.
 */
export function sub_168a(m) {
  const { regs, mem } = m;
  m.push16(0x168b); m.step(0x0018, 11); if (!m.call(0x0018)) return; // rst 0x18
  regs.hl = 0x388c;
  m.step(0x168e, 10);
  m.push16(0x1691); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.a = 0x66;
  m.step(0x1693, 7);
  mem.write8(0x690c, regs.a);
  m.step(0x1696, 13);
  regs.xor(regs.a);
  m.step(0x1697, 4);
  mem.write8(0x6924, regs.a);
  m.step(0x169a, 13);
  mem.write8(0x692c, regs.a);
  m.step(0x169d, 13);
  mem.write8(0x62af, regs.a);
  m.step(0x16a0, 13);
  m.step(0x1662, 10); // jp 0x1662
  return m.call(0x1662);
}
