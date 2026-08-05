// SPDX-License-Identifier: GPL-3.0-only

// loc_36af  (ROM 0x36AF–0x3792)
export function loc_36af(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xacc6);
  m.step(0x36b2, 13); // ld a,(0xacc6)
  regs.and(regs.a);
  m.step(0x36b3, 4); // and a
  if (regs.fNZ) {
    m.step(m.pop16(), 11); // ret nz
    return;
  }
  m.step(0x36b4, 5);

  regs.a = mem.read8(0xad04);
  m.step(0x36b7, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x36b9, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x386e, 10); // jp z,0x386e
    return m.call(0x386e);
  }
  m.step(0x36bc, 10);

  regs.hl = 0xad05; // stays live through the three jumps below
  m.step(0x36bf, 10); // ld hl,0xad05
  regs.a = mem.read8(0xad06);
  m.step(0x36c2, 13); // ld a,(0xad06)
  regs.and(0x0f);
  m.step(0x36c4, 7); // and 0x0f
  regs.cp(0x07);
  m.step(0x36c6, 7); // cp 0x07
  if (regs.fZ) {
    m.step(0x3855, 10); // jp z,0x3855
    return m.call(0x3855);
  }
  m.step(0x36c9, 10);
  if (regs.fC) {
    m.step(0x37bd, 10); // jp c,0x37bd -- (0xad06)&0x0f < 7
    return m.call(0x37bd);
  }
  m.step(0x36cc, 10);
  regs.cp(0x09);
  m.step(0x36ce, 7); // cp 0x09
  if (regs.fC) {
    m.step(0x379f, 10); // jp c,0x379f -- == 8
    return m.call(0x379f);
  }
  m.step(0x36d1, 10);

  regs.a = mem.read8(regs.hl); // (0xad05)
  m.step(0x36d2, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x36d3, 4); // and a
  if (regs.fNZ) {
    m.step(m.pop16(), 11); // ret nz
    return;
  }
  m.step(0x36d4, 5);

  m.push16(0x36d7);
  m.step(0x4b4b, 17); // call 0x4b4b
  m.call(0x4b4b);

  regs.rrca(); // its bit 0 -> carry, for the adc below
  m.step(0x36d8, 4); // rrca
  regs.a = mem.read8(0xad04); // flag-neutral; carry survives
  m.step(0x36db, 13); // ld a,(0xad04)
  regs.adc(regs.a); // A = 2*(0xad04) + that carry bit
  m.step(0x36dc, 4); // adc a,a
  regs.hl = 0xacc2;
  m.step(0x36df, 10); // ld hl,0xacc2
  mem.write8(regs.hl, 0xff);
  m.step(0x36e1, 10); // ld (hl),0xff
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x36e2, 6); // inc hl
  mem.write8(regs.hl, regs.a); // 0xacc3
  m.step(0x36e3, 7); // ld (hl),a

  regs.a = mem.read8(0xa802);
  m.step(0x36e6, 13); // ld a,(0xa802)
  regs.add(0x08); // round-to-nearest before the >>4
  m.step(0x36e8, 7); // add a,0x08
  regs.rrca();
  m.step(0x36e9, 4); // rrca
  regs.rrca();
  m.step(0x36ea, 4); // rrca
  regs.rrca();
  m.step(0x36eb, 4); // rrca
  regs.rrca();
  m.step(0x36ec, 4); // rrca
  regs.and(0x0f); // 16 steps
  m.step(0x36ee, 7); // and 0x0f
  regs.hl = 0x38d9;
  m.step(0x36f1, 10); // ld hl,0x38d9

  m.push16(0x36f2);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.c = mem.read8(regs.hl); // the per-slot bias, live for the whole loop
  m.step(0x36f3, 7); // ld c,(hl)
  regs.a = mem.read8(0xacc3);
  m.step(0x36f6, 13); // ld a,(0xacc3)
  regs.add(regs.a);
  m.step(0x36f7, 4); // add a,a
  regs.add(regs.a);
  m.step(0x36f8, 4); // add a,a
  regs.add(regs.a);
  m.step(0x36f9, 4); // add a,a
  regs.add(regs.a);
  m.step(0x36fa, 4); // add a,a -- 16-byte stride
  regs.hl = 0x397b;
  m.step(0x36fd, 10); // ld hl,0x397b

  m.push16(0x36fe);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.exDeHl(); // DE = the wave descriptor pointer
  m.step(0x36ff, 4); // ex de,hl
  regs.a = mem.read8(0xacc1);
  m.step(0x3702, 13); // ld a,(0xacc1)
  regs.b = regs.a;
  m.step(0x3703, 4); // ld b,a
  regs.a = mem.read8(0xad02);
  m.step(0x3706, 13); // ld a,(0xad02)
  regs.and(regs.a);
  m.step(0x3707, 4); // and a
  if (regs.fNZ) {
    m.step(0x370b, 12); // jr nz,0x370b -- keep B = (0xacc1)
  } else {
    m.step(0x3709, 7);
    regs.b = 0x05;
    m.step(0x370b, 7); // ld b,0x05
  }

  regs.xor(regs.a);
  m.step(0x370c, 4); // xor a
  mem.write8(0xa811, regs.a); // filled-slot counter
  m.step(0x370f, 13); // ld (0xa811),a
  regs.ix = 0xa850;
  m.step(0x3713, 14); // ld ix,0xa850
  regs.iy = 0xaa1a;
  m.step(0x3717, 14); // ld iy,0xaa1a

  do {
    regs.a = mem.read8(X(0x00));
    m.step(0x371a, 19); // ld a,(ix+0x00)
    regs.and(regs.a);
    m.step(0x371b, 4); // and a
    if (regs.fNZ) {
      m.step(0x3768, 10); // jp nz,0x3768 -- slot in use, skip it
    } else {
      m.step(0x371e, 10);

      regs.a = mem.read8(regs.de); // wave descriptor byte
      m.step(0x371f, 7); // ld a,(de)
      regs.add(regs.c);
      m.step(0x3720, 4); // add a,c
      regs.add(regs.a); // two-byte entries
      m.step(0x3721, 4); // add a,a
      regs.hl = 0x38e9;
      m.step(0x3724, 10); // ld hl,0x38e9

      m.push16(0x3725);
      m.step(0x0008, 11); // rst 0x08 -- HL += A, A = (HL)
      m.call(0x0008);

      mem.write8(Y(0x31), regs.a);
      m.step(0x3728, 19); // ld (iy+0x31),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x3729, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x372a, 7); // ld a,(hl)
      mem.write8(Y(0x00), regs.a);
      m.step(0x372d, 19); // ld (iy+0x00),a

      regs.a = mem.read8(0xa802);
      m.step(0x3730, 13); // ld a,(0xa802)
      regs.add(0x80);
      m.step(0x3732, 7); // add a,0x80
      mem.write8(X(0x01), regs.a);
      m.step(0x3735, 19); // ld (ix+0x01),a
      mem.write8(X(0x02), regs.a);
      m.step(0x3738, 19); // ld (ix+0x02),a

      m.push16(0x373b);
      m.step(0x382d, 17); // call 0x382d -- returns a value in A
      m.call(0x382d);

      regs.add(0x09);
      m.step(0x373d, 7); // add a,0x09
      mem.write8(X(0x0a), regs.a);
      m.step(0x3740, 19); // ld (ix+0x0a),a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x3741, 6); // inc de
      regs.a = mem.read8(regs.de);
      m.step(0x3742, 7); // ld a,(de)
      mem.write8(X(0x0e), regs.a);
      m.step(0x3745, 19); // ld (ix+0x0e),a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x3746, 6); // inc de
      mem.write8(X(0x03), 0x00);
      m.step(0x374a, 19); // ld (ix+0x03),0x00
      mem.write8(X(0x05), 0x00);
      m.step(0x374e, 19); // ld (ix+0x05),0x00
      mem.write8(X(0x09), 0x20);
      m.step(0x3752, 19); // ld (ix+0x09),0x20

      regs.exx(); // protect BC (loop counter + bias) and DE across the call
      m.step(0x3753, 4); // exx

      m.push16(0x3756);
      m.step(0x323a, 17); // call 0x323a
      m.call(0x323a);

      regs.exx();
      m.step(0x3757, 4); // exx

      mem.write8(X(0x00), 0xfe);
      m.step(0x375b, 19); // ld (ix+0x00),0xfe
      regs.a = mem.read8(X(0x0e));
      m.step(0x375e, 19); // ld a,(ix+0x0e)
      regs.and(regs.a);
      m.step(0x375f, 4); // and a
      if (regs.fNZ) {
        m.step(0x3764, 12); // jr nz,0x3764 -- leave (ix+0x00) at 0xfe
      } else {
        m.step(0x3761, 7);
        regs.incMem8(mem, X(0x00)); // 0xfe -> 0xff
        m.step(0x3764, 23); // inc (ix+0x00)
      }

      regs.hl = 0xa811;
      m.step(0x3767, 10); // ld hl,0xa811
      regs.incMem8(mem, regs.hl);
      m.step(0x3768, 11); // inc (hl)
    }

    regs.exDeHl();
    m.step(0x3769, 4); // ex de,hl
    regs.de = 0x0010;
    m.step(0x376c, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x376e, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x3770, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x3772, 10); // inc iy
    regs.exDeHl(); // DE = the descriptor pointer again
    m.step(0x3773, 4); // ex de,hl
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x3717 : 0x3775, regs.b !== 0 ? 13 : 8); // djnz 0x3717
  } while (regs.b !== 0);

  regs.xor(regs.a);
  m.step(0x3776, 4); // xor a
  mem.write8(0xacc2, regs.a);
  m.step(0x3779, 13); // ld (0xacc2),a
  regs.a = 0xe4;
  m.step(0x377b, 7); // ld a,0xe4
  mem.write8(0xa812, regs.a);
  m.step(0x377e, 13); // ld (0xa812),a
  regs.hl = 0xa811;
  m.step(0x3781, 10); // ld hl,0xa811
  regs.a = mem.read8(regs.hl); // slots filled
  m.step(0x3782, 7); // ld a,(hl)
  regs.cp(0x05);
  m.step(0x3784, 7); // cp 0x05
  if (regs.fNC) {
    m.step(0x5817, 10); // jp nc,0x5817
    return m.call(0x5817);
  }
  m.step(0x3787, 10);

  regs.hl = 0xacc1;
  m.step(0x378a, 10); // ld hl,0xacc1
  regs.cp(mem.read8(regs.hl)); // these flags are what the 0x378F jp reads
  m.step(0x378b, 7); // cp (hl)
  regs.a = mem.read8(regs.hl); // flag-neutral
  m.step(0x378c, 7); // ld a,(hl)
  mem.write8(0xa811, regs.a); // flag-neutral
  m.step(0x378f, 13); // ld (0xa811),a
  if (regs.fNC) {
    m.step(0x5817, 10); // jp nc,0x5817 -- still on the 0x378A cp
    return m.call(0x5817);
  }
  m.step(0x3792, 10);

  m.ret(); // 3792
}
