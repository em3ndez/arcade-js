// SPDX-License-Identifier: GPL-3.0-only

// loc_780f  (ROM 0x780f-0x7820) -- 2x2 tile-block writer: copies 4 bytes from (DE++) into a
// 2x2 cell around (HL): HL, HL+1 (this row) and HL-0x20, HL-0x1f (the row above, 0x20-wide map).
// BC = 0xffe0 (-0x20) is the up-one-row step. Straight-line, no calls; each m.step carries the
// landing so the flow is traceable. Entry point; ret at 0x7820. (0x7821-0x7880 that follow are
// data tables consumed by loc_7881, not code.)
export function loc_780f(m) {
  const { regs, mem } = m;

  regs.bc = 0xffe0;
  m.step(0x7812, 10); // 780f  ld bc,0xffe0
  regs.a = mem.read8(regs.de);
  m.step(0x7813, 7); // 7812  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x7814, 7); // 7813  ld (hl),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x7815, 6); // 7814  inc de
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x7816, 6); // 7815  inc hl
  regs.a = mem.read8(regs.de);
  m.step(0x7817, 7); // 7816  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x7818, 7); // 7817  ld (hl),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x7819, 6); // 7818  inc de
  regs.addHl(regs.bc);
  m.step(0x781a, 11); // 7819  add hl,bc  -- HL -= 0x20 (up one row)
  regs.a = mem.read8(regs.de);
  m.step(0x781b, 7); // 781a  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x781c, 7); // 781b  ld (hl),a
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x781d, 6); // 781c  dec hl
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x781e, 6); // 781d  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x781f, 7); // 781e  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x7820, 7); // 781f  ld (hl),a
  m.ret(); // 7820  ret
}
