// SPDX-License-Identifier: GPL-3.0-only

// loc_33b8  (ROM 0x33B8–0x3414)
export function loc_33b8(m) {
  const { regs, mem } = m;

  regs.c = 0x00;
  m.step(0x33ba, 7); // ld c,0x00
  regs.b = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x33bd, 19); // ld b,(iy+0x31)
  regs.e = mem.read8(regs.hl);
  m.step(0x33be, 7); // ld e,(hl)
  regs.l = regs.dec8(regs.l); // dec l -- 8-bit, sets flags
  m.step(0x33bf, 4); // dec l
  regs.a = mem.read8(regs.hl);
  m.step(0x33c0, 7); // ld a,(hl)
  regs.sub(regs.b);
  m.step(0x33c1, 4); // sub b

  if (regs.fNC) {
    m.step(0x33c7, 12); // jr nc,0x33c7 taken
  } else {
    m.step(0x33c3, 7); // jr nc not taken
    regs.neg();
    m.step(0x33c5, 8); // neg
    regs.c = regs.set(0, regs.c); // no flags
    m.step(0x33c7, 8); // set 0,c
  }

  regs.d = regs.a;
  m.step(0x33c8, 4); // ld d,a
  regs.b = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x33cb, 19); // ld b,(iy+0x00)
  regs.a = regs.e;
  m.step(0x33cc, 4); // ld a,e
  regs.sub(regs.b);
  m.step(0x33cd, 4); // sub b

  if (regs.fNC) {
    m.step(0x33d3, 12); // jr nc,0x33d3 taken
  } else {
    m.step(0x33cf, 7); // jr nc not taken
    regs.neg();
    m.step(0x33d1, 8); // neg
    regs.c = regs.set(1, regs.c); // no flags
    m.step(0x33d3, 8); // set 1,c
  }

  regs.e = regs.a;
  m.step(0x33d4, 4); // ld e,a
  regs.exAf();
  m.step(0x33d5, 4); // ex af,af'
  regs.a = regs.e; // writes the ALTERNATE A; no flags
  m.step(0x33d6, 4); // ld a,e
  regs.exAf();
  m.step(0x33d7, 4); // ex af,af'
  regs.sub(regs.d);
  m.step(0x33d8, 4); // sub d

  if (regs.fZ) {
    m.step(0x340f, 12); // jr z,0x340f taken -- |d1| == |d2|
    regs.hl = 0x341d;
    m.step(0x3412, 10); // ld hl,0x341d
    regs.a = regs.c;
    m.step(0x3413, 4); // ld a,c
    m.push16(0x3414);
    m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
    m.call(0x0008);
    m.ret(); // 0x3414
    return;
  }
  m.step(0x33da, 7); // jr z not taken

  if (regs.fNC) {
    m.step(0x33de, 12); // jr nc,0x33de taken
  } else {
    m.step(0x33dc, 7); // jr nc not taken
    regs.c = regs.set(2, regs.c); // no flags
    m.step(0x33de, 8); // set 2,c
  }

  regs.l = 0x00;
  m.step(0x33e0, 7); // ld l,0x00
  regs.bit(2, regs.c);
  m.step(0x33e2, 8); // bit 2,c

  if (regs.fNZ) {
    m.step(0x33e7, 12); // jr nz,0x33e7 taken
    regs.h = regs.e;
    m.step(0x33e8, 4); // ld h,e
    regs.e = regs.d;
    m.step(0x33e9, 4); // ld e,d
  } else {
    m.step(0x33e4, 7); // jr nz not taken
    regs.h = regs.d;
    m.step(0x33e5, 4); // ld h,d
    m.step(0x33e9, 12); // jr 0x33e9
  }

  regs.b = 0x08;
  m.step(0x33eb, 7); // ld b,0x08
  regs.xor(regs.a); // clears carry for the first adc
  m.step(0x33ec, 4); // xor a

  do {
    regs.adcHl(regs.hl);
    m.step(0x33ee, 15); // adc hl,hl
    regs.a = regs.h;
    m.step(0x33ef, 4); // ld a,h

    let subtract;
    if (regs.fC) {
      m.step(0x33f4, 12); // jr c,0x33f4 taken
      subtract = true;
    } else {
      m.step(0x33f1, 7); // jr c not taken
      regs.cp(regs.e);
      m.step(0x33f2, 4); // cp e
      if (regs.fC) {
        m.step(0x33f7, 12); // jr c,0x33f7 taken -- does not fit
        subtract = false;
      } else {
        m.step(0x33f4, 7); // jr c not taken
        subtract = true;
      }
    }

    if (subtract) {
      regs.sub(regs.e);
      m.step(0x33f5, 4); // sub e
      regs.h = regs.a;
      m.step(0x33f6, 4); // ld h,a
      regs.xor(regs.a); // clears carry -> ccf makes it 1
      m.step(0x33f7, 4); // xor a
    }

    regs.ccf();
    m.step(0x33f8, 4); // ccf
    regs.djnz();
    m.step(regs.b !== 0 ? 0x33ec : 0x33fa, regs.b !== 0 ? 13 : 8); // djnz 0x33ec
  } while (regs.b !== 0);

  regs.b = regs.l;
  m.step(0x33fb, 4); // ld b,l
  regs.a = regs.c;
  m.step(0x33fc, 4); // ld a,c
  regs.hl = 0x3415;
  m.step(0x33ff, 10); // ld hl,0x3415
  m.push16(0x3400);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.a = regs.b;
  m.step(0x3401, 4); // ld a,b
  regs.rrca();
  m.step(0x3402, 4); // rrca
  regs.rrca();
  m.step(0x3403, 4); // rrca
  regs.and(0x1f);
  m.step(0x3405, 7); // and 0x1f
  regs.bit(5, mem.read8(regs.hl));
  m.step(0x3407, 12); // bit 5,(hl)

  if (regs.fZ) {
    m.step(0x340d, 12); // jr z,0x340d taken
  } else {
    m.step(0x3409, 7); // jr z not taken
    regs.b = regs.a;
    m.step(0x340a, 4); // ld b,a
    regs.a = 0x1f;
    m.step(0x340c, 7); // ld a,0x1f
    regs.sub(regs.b);
    m.step(0x340d, 4); // sub b
  }

  regs.add(mem.read8(regs.hl));
  m.step(0x340e, 7); // add a,(hl)
  m.ret(); // 0x340e
}
