// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d30  (ROM 0x0D30–0x0D42) — fill 0x11 cells 0xFD, +0x0F, fill 0x11 cells 0xFC. HL live-in.
 */
export function loc_0d30(m) {
  const { regs, mem } = m;
  regs.b = 0x11;
  m.step(0x0d32, 7);
  do {
    mem.write8(regs.hl, 0xfd);
    m.step(0x0d34, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d35, 6);
    regs.djnz();
    m.step(regs.b ? 0x0d32 : 0x0d37, regs.b ? 13 : 8);
  } while (regs.b);
  regs.de = 0x000f;
  m.step(0x0d3a, 10);
  regs.addHl(regs.de);
  m.step(0x0d3b, 11);
  regs.b = 0x11;
  m.step(0x0d3d, 7);
  do {
    mem.write8(regs.hl, 0xfc);
    m.step(0x0d3f, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d40, 6);
    regs.djnz();
    m.step(regs.b ? 0x0d3d : 0x0d42, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
