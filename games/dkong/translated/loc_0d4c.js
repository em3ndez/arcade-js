// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d4c  (ROM 0x0D4C–0x0D5E) — fill 0x04 cells 0xFD, +0x1C, fill 0x04 cells 0xFC. HL live-in.
 */
export function loc_0d4c(m) {
  const { regs, mem } = m;
  regs.b = 0x04;
  m.step(0x0d4e, 7);
  do {
    mem.write8(regs.hl, 0xfd);
    m.step(0x0d50, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d51, 6);
    regs.djnz();
    m.step(regs.b ? 0x0d4e : 0x0d53, regs.b ? 13 : 8);
  } while (regs.b);
  regs.de = 0x001c;
  m.step(0x0d56, 10);
  regs.addHl(regs.de);
  m.step(0x0d57, 11);
  regs.b = 0x04;
  m.step(0x0d59, 7);
  do {
    mem.write8(regs.hl, 0xfc);
    m.step(0x0d5b, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d5c, 6);
    regs.djnz();
    m.step(regs.b ? 0x0d59 : 0x0d5e, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
