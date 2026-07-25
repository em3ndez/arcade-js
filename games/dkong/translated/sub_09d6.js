// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_09d6  (ROM 0x09D6–0x09ED) — clear palette latches, enqueue 0x0302/0x0201, 0x600A=5, then the shared sub_09ee tail.
 */
export function sub_09d6(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x09d7, 4);
  mem.write8(0x7d86, regs.a);
  m.step(0x09da, 13);
  mem.write8(0x7d87, regs.a);
  m.step(0x09dd, 13);
  regs.de = 0x0302;
  m.step(0x09e0, 10);
  m.push16(0x09e3); m.step(0x309f, 17); m.call(0x309f);
  regs.de = 0x0201;
  m.step(0x09e6, 10);
  m.push16(0x09e9); m.step(0x309f, 17); m.call(0x309f);
  regs.a = 0x05;
  m.step(0x09eb, 7);
  mem.write8(0x600a, regs.a);
  m.step(0x09ee, 13); // 0x600A = 5 -> fall into sub_09ee
  return m.call(0x09ee);
}
