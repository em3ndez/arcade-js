// SPDX-License-Identifier: GPL-3.0-only

// loc_026f  (ROM 0x026F–0x028F)
export function loc_026f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9e4); // row
  m.step(0x0272, 13); // ld a,(0xa9e4)
  regs.add(regs.a);
  m.step(0x0273, 4); // add a,a
  regs.add(regs.a);
  m.step(0x0274, 4); // add a,a
  regs.add(regs.a); // A = row * 8 (8-bit, carry discarded)
  m.step(0x0275, 4); // add a,a
  regs.l = regs.a;
  m.step(0x0276, 4); // ld l,a
  regs.h = 0x00;
  m.step(0x0278, 7); // ld h,0x00
  regs.addHl(regs.hl);
  m.step(0x0279, 11); // add hl,hl
  regs.addHl(regs.hl); // HL = row * 32
  m.step(0x027a, 11); // add hl,hl

  regs.a = mem.read8(0xa9e6); // column
  m.step(0x027d, 13); // ld a,(0xa9e6)
  regs.add(regs.l); // 8-bit; the carry out of L is dropped
  m.step(0x027e, 4); // add a,l
  regs.l = regs.a;
  m.step(0x027f, 4); // ld l,a
  regs.a = 0xa4;
  m.step(0x0281, 7); // ld a,0xa4
  regs.add(regs.h);
  m.step(0x0282, 4); // add a,h
  regs.h = regs.a; // HL = 0xA400 + row*32 + column
  m.step(0x0283, 4); // ld h,a

  regs.a = mem.read8(0xad0b);
  m.step(0x0286, 13); // ld a,(0xad0b)
  mem.write8(regs.hl, regs.a); // video RAM
  m.step(0x0287, 7); // ld (hl),a
  regs.h = regs.res(2, regs.h); // 0xA4xx -> 0xA0xx, the colour plane
  m.step(0x0289, 8); // res 2,h
  regs.a = mem.read8(0xad0c);
  m.step(0x028c, 13); // ld a,(0xad0c)
  mem.write8(regs.hl, regs.a); // colour RAM
  m.step(0x028d, 7); // ld (hl),a
  regs.h = regs.set(2, regs.h); // back to the video plane
  m.step(0x028f, 8); // set 2,h

  m.ret(10); // ret (0x028F)
}
