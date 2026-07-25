// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0478  (ROM 0x0478–0x0485) — (6227) bit0==0 arm (COLD): rst 0x38 sprite offset, then loc_0486.
 */
export function loc_0478(m) {
  const { regs, mem } = m;
  regs.hl = 0x6908;
  m.step(0x047b, 10); // ld hl,0x6908
  regs.c = 0x44;
  m.step(0x047d, 7); // ld c,0x44
  regs.rrca();
  m.step(0x047e, 4); // rrca -- C = (6227) bit1
  if (regs.fNC) {
    m.step(0x0485, 10); // jp nc,0x0485 (taken)
  } else {
    m.step(0x0481, 10); // bit1==1
    regs.a = mem.read8(0x63b7);
    m.step(0x0484, 13); // ld a,(0x63b7)
    regs.c = regs.a;
    m.step(0x0485, 4); // ld c,a
  }
  m.push16(0x0486); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 -> falls into 0x0486
  return m.call(0x0486);
}
