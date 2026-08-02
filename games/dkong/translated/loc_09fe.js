// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_09fe  (ROM 0x09FE–0x0A1A) — copy 0x6048->0x6228[8], set board id (0x6227) from (0x622A) deref, arm 0x6009=0x78/0x600A=4.
 */
export function loc_09fe(m) {
  const { regs, mem } = m;
  regs.hl = 0x6048;
  m.step(0x0a01, 10);
  regs.de = 0x6228;
  m.step(0x0a04, 10);
  regs.bc = 0x0008;
  m.step(0x0a07, 10);
  m.ldirAt(0x0a07, 0x0a09); // 8-byte copy
  regs.hl = mem.read16(0x622a);
  m.step(0x0a0c, 16); // ld hl,(0x622a)
  regs.a = mem.read8(regs.hl);
  m.step(0x0a0d, 7);
  mem.write8(0x6227, regs.a);
  m.step(0x0a10, 13); // board id
  regs.a = 0x78;
  m.step(0x0a12, 7);
  mem.write8(0x6009, regs.a);
  m.step(0x0a15, 13);
  regs.a = 0x04;
  m.step(0x0a17, 7);
  mem.write8(0x600a, regs.a);
  m.step(0x0a1a, 13);
  m.ret(10);
}
