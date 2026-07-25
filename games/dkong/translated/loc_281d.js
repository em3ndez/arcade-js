// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_281d  (ROM 0x281D–0x2852).
 */
export function loc_281d(m) {
  const { regs, mem } = m;

  regs.b = 0x02;
  m.step(0x281f, 7); // ld b,0x02
  regs.de = 0x0010;
  m.step(0x2822, 10); // ld de,0x0010
  regs.iy = 0x6680;
  m.step(0x2826, 14); // ld iy,0x6680

  for (;;) {
    regs.bit(0, mem.read8((regs.iy + 0x01) & 0xffff)); // bit 0,(iy+0x01)
    m.step(0x282a, 20);
    if (regs.fNZ) {
      m.step(0x2832, 10); // jp nz,0x2832 -- found
      break;
    }
    m.step(0x282d, 10); // jp nz not taken
    regs.addIy(regs.de); // add iy,de -- FIRST executable use of addIy
    m.step(0x282f, 15);
    regs.djnz();
    if (regs.b !== 0) {
      m.step(0x2826, 13); // djnz 0x2826
      continue;
    }
    m.step(0x2831, 8); // djnz not taken
    m.ret(); // none found
    return;
  }

  // -- loc_2832: found --
  regs.c = mem.read8((regs.iy + 0x05) & 0xffff);
  m.step(0x2835, 19); // ld c,(iy+0x05)
  regs.h = mem.read8((regs.iy + 0x09) & 0xffff);
  m.step(0x2838, 19); // ld h,(iy+0x09)
  regs.l = mem.read8((regs.iy + 0x0a) & 0xffff);
  m.step(0x283b, 19); // ld l,(iy+0x0a)

  m.push16(0x283e);
  m.step(0x286f, 17); // call 0x286f -- in HL/C; out A, IX
  m.call(0x286f);

  regs.and(regs.a);
  m.step(0x283f, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- A == 0, not stored
    return;
  }
  m.step(0x2840, 5); // ret z NOT taken

  mem.write8(0x6350, regs.a);
  m.step(0x2843, 13); // ld (0x6350),a
  regs.a = mem.read8(0x63b9); // set by 0x286f
  m.step(0x2846, 13); // ld a,(0x63b9)
  regs.sub(regs.b); // sub b -- 0x63B9 - B
  m.step(0x2847, 4);
  mem.write8(0x6354, regs.a);
  m.step(0x284a, 13); // ld (0x6354),a
  regs.a = regs.e;
  m.step(0x284b, 4); // ld a,e
  mem.write8(0x6353, regs.a);
  m.step(0x284e, 13); // ld (0x6353),a
  mem.write16(0x6351, regs.ix); // ld (0x6351),ix -- IX from 0x286f
  m.step(0x2852, 20);
  m.ret(); // ret (0x2852)
}
