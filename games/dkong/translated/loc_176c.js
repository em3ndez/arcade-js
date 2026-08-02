// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_176c  (ROM 0x176C–0x1782) — clamp scan: over 10 cells at 0x692F, HL-=3 via sbc hl,de; if (HL low)<0x19 zero (HL).
 */
export function loc_176c(m) {
  const { regs, mem } = m;
  regs.de = 0x0003;
  m.step(0x176f, 10); // ld de,0x0003
  regs.hl = 0x692f;
  m.step(0x1772, 10); // ld hl,0x692f
  regs.b = 0x0a;
  m.step(0x1774, 7); // ld b,0x0a
  do {
    regs.and(regs.a);
    m.step(0x1775, 4); // and a -- clear carry
    regs.a = mem.read8(regs.hl);
    m.step(0x1776, 7); // ld a,(hl)
    regs.sbcHl(regs.de);
    m.step(0x1778, 15); // sbc hl,de (bare)
    regs.cp(0x19);
    m.step(0x177a, 7); // cp 0x19
    if (regs.fNC) {
      m.step(0x177f, 10); // jp nc -- keep
    } else {
      m.step(0x177d, 10);
      mem.write8(regs.hl, 0x00);
      m.step(0x177f, 10); // ld (hl),0x00
    }
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1780, 6); // dec hl
    regs.djnz();
    m.step(regs.b ? 0x1774 : 0x1782, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
