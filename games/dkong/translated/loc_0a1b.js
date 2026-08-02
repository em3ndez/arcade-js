// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a1b  (ROM 0x0A1B–0x0A36) — clear palette latches, enqueue 0x0303/0x0201, shared sub_09ee tail, 0x600A=5.
 */
export function loc_0a1b(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x0a1c, 4);
  mem.write8(0x7d86, regs.a);
  m.step(0x0a1f, 13);
  mem.write8(0x7d87, regs.a);
  m.step(0x0a22, 13);
  regs.de = 0x0303;
  m.step(0x0a25, 10);
  m.push16(0x0a28); m.step(0x309f, 17); m.call(0x309f);
  regs.de = 0x0201;
  m.step(0x0a2b, 10);
  m.push16(0x0a2e); m.step(0x309f, 17); m.call(0x309f);
  m.push16(0x0a31); m.step(0x09ee, 17); m.call(0x09ee); // shared tail
  regs.a = 0x05;
  m.step(0x0a33, 7);
  mem.write8(0x600a, regs.a);
  m.step(0x0a36, 13);
  m.ret(10);
}
