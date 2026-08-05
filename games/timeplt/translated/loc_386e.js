// SPDX-License-Identifier: GPL-3.0-only

// loc_386e  (ROM 0x386E–0x38D1)
export function loc_386e(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.ix = 0xa850;
  m.step(0x3872, 14); // ld ix,0xa850
  regs.iy = 0xaa1a;
  m.step(0x3876, 14); // ld iy,0xaa1a
  regs.a = mem.read8(0xacc1);
  m.step(0x3879, 13); // ld a,(0xacc1)
  regs.b = regs.a;
  m.step(0x387a, 4); // ld b,a
  regs.a = mem.read8(0xad0d);
  m.step(0x387d, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x387e, 4); // and a
  if (regs.fZ) {
    m.step(0x3882, 12); // jr z,0x3882 TAKEN -- keep the 0xACC1 count
  } else {
    m.step(0x3880, 7); // jr z NOT taken
    regs.b = 0x05;
    m.step(0x3882, 7); // ld b,0x05
  }

  do {
    m.push16(regs.bc);
    m.step(0x3883, 11); // push bc
    regs.a = mem.read8(IX(0x00));
    m.step(0x3886, 19); // ld a,(ix+0x00)
    regs.and(regs.a);
    m.step(0x3887, 4); // and a
    if (regs.fNZ) {
      m.step(0x38c0, 10); // jp nz,0x38c0 TAKEN -- slot busy
    } else {
      m.step(0x388a, 10); // jp nz NOT taken -- slot free, spawn into it

      m.push16(0x388d);
      m.step(0x4b4b, 17); // call 0x4b4b -- RNG
      m.call(0x4b4b);

      regs.and(0xfc);
      m.step(0x388f, 7); // and 0xfc
      regs.hl = 0x3a3b;
      m.step(0x3892, 10); // ld hl,0x3a3b

      m.push16(0x3893);
      m.step(0x0008, 11); // rst 0x08 -- A = (HL + A); HL left at that byte
      m.call(0x0008);

      mem.write8(IY(0x31), regs.a);
      m.step(0x3896, 19); // ld (iy+0x31),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x3897, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x3898, 7); // ld a,(hl)
      mem.write8(IY(0x00), regs.a);
      m.step(0x389b, 19); // ld (iy+0x00),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x389c, 6); // inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x389d, 7); // ld a,(hl)
      mem.write8(IX(0x01), regs.a);
      m.step(0x38a0, 19); // ld (ix+0x01),a
      mem.write8(IX(0x02), regs.a);
      m.step(0x38a3, 19); // ld (ix+0x02),a

      regs.a = mem.read8(0xacc1);
      m.step(0x38a6, 13); // ld a,(0xacc1)
      regs.sub(regs.b); // B = slots remaining -> A = this slot's ordinal
      m.step(0x38a7, 4); // sub b
      regs.hl = 0x38d2;
      m.step(0x38aa, 10); // ld hl,0x38d2

      m.push16(0x38ab);
      m.step(0x0008, 11); // rst 0x08 -- A = (0x38d2 + ordinal)
      m.call(0x0008);

      mem.write8(IX(0x0a), regs.a);
      m.step(0x38ae, 19); // ld (ix+0x0a),a
      mem.write8(IX(0x09), 0x20);
      m.step(0x38b2, 19); // ld (ix+0x09),0x20

      m.push16(0x38b5);
      m.step(0x323a, 17); // call 0x323a
      m.call(0x323a);

      mem.write8(IX(0x04), 0x01);
      m.step(0x38b9, 19); // ld (ix+0x04),0x01
      mem.write8(IX(0x0e), 0x00);
      m.step(0x38bd, 19); // ld (ix+0x0e),0x00
      regs.decMem8(mem, IX(0x00)); // dec (ix+0x00) -- 0x00 -> 0xFF
      m.step(0x38c0, 23); // dec (ix+0x00)
    }

    regs.de = 0x0010;
    m.step(0x38c3, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x38c5, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x38c7, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x38c9, 10); // inc iy
    regs.bc = m.pop16();
    m.step(0x38ca, 10); // pop bc -- restores the loop counter
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3882 : 0x38cc, regs.b !== 0 ? 13 : 8); // djnz 0x3882
  } while (regs.b !== 0);

  regs.a = 0xe4;
  m.step(0x38ce, 7); // ld a,0xe4
  mem.write8(0xa812, regs.a);
  m.step(0x38d1, 13); // ld (0xa812),a
  m.ret(); // 38d1
}
