// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1708  (ROM 0x1708–0x1731) — init: record 80 76 09 20 at 0x6A20, 0x6905=0x13, colour column (0x0514), 0x608A/B=07/03.
 */
export function loc_1708(m) {
  const { regs, mem } = m;
  m.push16(0x170b); m.step(0x011c, 17); m.call(0x011c); // call 0x011c
  regs.hl = 0x6a20;
  m.step(0x170e, 10);
  mem.write8(regs.hl, 0x80);
  m.step(0x1710, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1711, 6);
  mem.write8(regs.hl, 0x76);
  m.step(0x1713, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1714, 6);
  mem.write8(regs.hl, 0x09);
  m.step(0x1716, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1717, 6);
  mem.write8(regs.hl, 0x20);
  m.step(0x1719, 10); // record 80 76 09 20 at 0x6A20
  regs.hl = 0x6905;
  m.step(0x171c, 10);
  mem.write8(regs.hl, 0x13);
  m.step(0x171e, 10); // 0x6905 = 0x13
  regs.hl = 0x75c4;
  m.step(0x1721, 10);
  regs.de = 0x0020;
  m.step(0x1724, 10);
  regs.a = 0x10;
  m.step(0x1726, 7);
  m.push16(0x1729); m.step(0x0514, 17); m.call(0x0514); // colour column
  regs.hl = 0x608a;
  m.step(0x172c, 10);
  mem.write8(regs.hl, 0x07);
  m.step(0x172e, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x172f, 6);
  mem.write8(regs.hl, 0x03);
  m.step(0x1731, 10); // 0x608A/B = 07/03
  m.ret(10);
}
