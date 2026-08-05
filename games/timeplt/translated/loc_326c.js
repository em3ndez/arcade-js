// SPDX-License-Identifier: GPL-3.0-only

// loc_326c  (ROM 0x326C-0x32EA, Time Pilot)
export function loc_326c(m) {
  const { regs, mem } = m;

  regs.a = regs.c;
  m.step(0x326d, 4); // ld a,c -- the 0xAD05 byte, live-in from loc_31b4

  regs.and(0x0f);
  m.step(0x326f, 7); // and 0x0f

  regs.cp(0x07);
  m.step(0x3271, 7); // cp 0x07

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- not this sub-mode
    return;
  }
  m.step(0x3272, 5); // ret nz not taken

  regs.ix = 0xac64;
  m.step(0x3276, 14); // ld ix,0xac64

  regs.a = mem.read8(0xa802);
  m.step(0x3279, 13); // ld a,(0xa802)

  regs.add(0x40);
  m.step(0x327b, 7); // add a,0x40

  m.push16(0x327e);
  m.step(0x59d1, 17); // call 0x59d1 -- DE = 2*table[A], BC = 2*table[A+0xC0]
  m.call(0x59d1);

  regs.exDeHl();
  m.step(0x327f, 4); // ex de,hl -- HL = the DE term

  regs.addHl(regs.hl);
  m.step(0x3280, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x3281, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x3282, 11); // add hl,hl -- x8

  regs.a = regs.h;
  m.step(0x3283, 4); // ld a,h

  regs.add(0x78);
  m.step(0x3285, 7); // add a,0x78

  mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
  m.step(0x3288, 19); // ld (ix+0x10),a

  regs.a = regs.h;
  m.step(0x3289, 4); // ld a,h

  regs.neg();
  m.step(0x328b, 8); // neg

  regs.add(0x78);
  m.step(0x328d, 7); // add a,0x78, after neg

  mem.write8((regs.ix + 0x14) & 0xffff, regs.a);
  m.step(0x3290, 19); // ld (ix+0x14),a

  regs.addHl(regs.hl);
  m.step(0x3291, 11); // add hl,hl -- x16

  regs.a = regs.h;
  m.step(0x3292, 4); // ld a,h

  regs.add(0x78);
  m.step(0x3294, 7); // add a,0x78

  mem.write8((regs.ix + 0x12) & 0xffff, regs.a);
  m.step(0x3297, 19); // ld (ix+0x12),a

  regs.a = regs.h;
  m.step(0x3298, 4); // ld a,h

  regs.neg();
  m.step(0x329a, 8); // neg

  regs.add(0x78);
  m.step(0x329c, 7); // add a,0x78

  mem.write8((regs.ix + 0x16) & 0xffff, regs.a);
  m.step(0x329f, 19); // ld (ix+0x16),a

  regs.h = regs.b;
  m.step(0x32a0, 4); // ld h,b

  regs.l = regs.c;
  m.step(0x32a1, 4); // ld l,c -- HL = the BC term

  regs.addHl(regs.hl);
  m.step(0x32a2, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32a3, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32a4, 11); // add hl,hl -- x8

  regs.a = regs.h;
  m.step(0x32a5, 4); // ld a,h

  regs.add(0x84);
  m.step(0x32a7, 7); // add a,0x84

  mem.write8((regs.ix + 0x11) & 0xffff, regs.a);
  m.step(0x32aa, 19); // ld (ix+0x11),a

  regs.a = regs.h;
  m.step(0x32ab, 4); // ld a,h

  regs.neg();
  m.step(0x32ad, 8); // neg

  regs.add(0x84);
  m.step(0x32af, 7); // add a,0x84

  mem.write8((regs.ix + 0x15) & 0xffff, regs.a);
  m.step(0x32b2, 19); // ld (ix+0x15),a

  regs.addHl(regs.hl);
  m.step(0x32b3, 11); // add hl,hl -- x16

  regs.a = regs.h;
  m.step(0x32b4, 4); // ld a,h

  regs.add(0x84);
  m.step(0x32b6, 7); // add a,0x84

  mem.write8((regs.ix + 0x13) & 0xffff, regs.a);
  m.step(0x32b9, 19); // ld (ix+0x13),a

  regs.a = regs.h;
  m.step(0x32ba, 4); // ld a,h

  regs.neg();
  m.step(0x32bc, 8); // neg

  regs.add(0x84);
  m.step(0x32be, 7); // add a,0x84

  mem.write8((regs.ix + 0x17) & 0xffff, regs.a);
  m.step(0x32c1, 19); // ld (ix+0x17),a

  regs.a = mem.read8(0xa802);
  m.step(0x32c4, 13); // ld a,(0xa802) -- unshifted this time

  m.push16(0x32c7);
  m.step(0x59d1, 17); // call 0x59d1
  m.call(0x59d1);

  regs.exDeHl();
  m.step(0x32c8, 4); // ex de,hl -- HL = the DE term

  regs.addHl(regs.hl);
  m.step(0x32c9, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32ca, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32cb, 11); // add hl,hl -- x8

  regs.a = regs.h;
  m.step(0x32cc, 4); // ld a,h

  regs.add(0x78);
  m.step(0x32ce, 7); // add a,0x78

  mem.write8((regs.ix + 0x18) & 0xffff, regs.a);
  m.step(0x32d1, 19); // ld (ix+0x18),a

  regs.addHl(regs.hl);
  m.step(0x32d2, 11); // add hl,hl -- x16

  regs.a = regs.h;
  m.step(0x32d3, 4); // ld a,h

  regs.add(0x78);
  m.step(0x32d5, 7); // add a,0x78

  mem.write8((regs.ix + 0x1a) & 0xffff, regs.a);
  m.step(0x32d8, 19); // ld (ix+0x1a),a

  regs.h = regs.b;
  m.step(0x32d9, 4); // ld h,b

  regs.l = regs.c;
  m.step(0x32da, 4); // ld l,c -- HL = the BC term

  regs.addHl(regs.hl);
  m.step(0x32db, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32dc, 11); // add hl,hl

  regs.addHl(regs.hl);
  m.step(0x32dd, 11); // add hl,hl -- x8

  regs.a = regs.h;
  m.step(0x32de, 4); // ld a,h

  regs.add(0x84);
  m.step(0x32e0, 7); // add a,0x84

  mem.write8((regs.ix + 0x19) & 0xffff, regs.a);
  m.step(0x32e3, 19); // ld (ix+0x19),a

  regs.addHl(regs.hl);
  m.step(0x32e4, 11); // add hl,hl -- x16

  regs.a = regs.h;
  m.step(0x32e5, 4); // ld a,h

  regs.add(0x84);
  m.step(0x32e7, 7); // add a,0x84

  mem.write8((regs.ix + 0x1b) & 0xffff, regs.a);
  m.step(0x32ea, 19); // ld (ix+0x1b),a

  m.ret(); // 32ea  ret
}
