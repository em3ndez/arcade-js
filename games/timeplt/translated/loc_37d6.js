// SPDX-License-Identifier: GPL-3.0-only

// loc_37d6  (ROM 0x37D6-0x382C)
export function loc_37d6(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(IX(0x00));
  m.step(0x37d9, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x37da, 4); // and a
  if (regs.fNZ) {
    m.step(0x3847, 10); // jp nz,0x3847 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3847);
  }
  m.step(0x37dd, 10); // jp nz NOT taken -- the slot is free

  regs.decMem8(mem, IX(0x00)); // dec (ix+0x00) -- 0x00 -> 0xFF
  m.step(0x37e0, 23); // dec (ix+0x00)
  regs.a = mem.read8(0xa802);
  m.step(0x37e3, 13); // ld a,(0xa802)
  regs.rrca();
  m.step(0x37e4, 4); // rrca
  regs.rrca();
  m.step(0x37e5, 4); // rrca
  regs.and(0x3f);
  m.step(0x37e7, 7); // and 0x3f
  regs.c = regs.a;
  m.step(0x37e8, 4); // ld c,a -- the base direction

  m.push16(0x37eb);
  m.step(0x4b4b, 17); // call 0x4b4b -- RNG
  m.call(0x4b4b);

  regs.and(0x0f);
  m.step(0x37ed, 7); // and 0x0f
  regs.sub(0x08);
  m.step(0x37ef, 7); // sub 0x08 -- jitter of -8..+7
  regs.add(regs.c);
  m.step(0x37f0, 4); // add a,c
  regs.and(0x3f);
  m.step(0x37f2, 7); // and 0x3f
  regs.hl = 0x39fb;
  m.step(0x37f5, 10); // ld hl,0x39fb

  m.push16(0x37f6);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x39fb + A); HL left at that byte
  m.call(0x0008);

  regs.add(regs.a);
  m.step(0x37f7, 4); // add a,a
  regs.add(regs.a);
  m.step(0x37f8, 4); // add a,a -- x4, the 0x3A3B entry stride
  regs.hl = 0x3a3b;
  m.step(0x37fb, 10); // ld hl,0x3a3b

  m.push16(0x37fc);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x3a3b + 4*index); HL left at that byte
  m.call(0x0008);

  mem.write8(IY(0x31), regs.a);
  m.step(0x37ff, 19); // ld (iy+0x31),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3800, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x3801, 7); // ld a,(hl) -- entry byte 1
  mem.write8(IY(0x00), regs.a);
  m.step(0x3804, 19); // ld (iy+0x00),a

  regs.a = mem.read8(0xa802);
  m.step(0x3807, 13); // ld a,(0xa802)
  regs.add(0x80);
  m.step(0x3809, 7); // add a,0x80
  mem.write8(IX(0x01), regs.a);
  m.step(0x380c, 19); // ld (ix+0x01),a
  mem.write8(IX(0x02), regs.a);
  m.step(0x380f, 19); // ld (ix+0x02),a

  m.push16(0x3812);
  m.step(0x382d, 17); // call 0x382d
  m.call(0x382d);

  mem.write8(IX(0x0a), regs.a);
  m.step(0x3815, 19); // ld (ix+0x0a),a
  regs.xor(regs.a);
  m.step(0x3816, 4); // xor a
  mem.write8(0xacc5, regs.a);
  m.step(0x3819, 13); // ld (0xacc5),a
  mem.write8(IX(0x03), 0x00);
  m.step(0x381d, 19); // ld (ix+0x03),0x00
  mem.write8(IX(0x05), 0x00);
  m.step(0x3821, 19); // ld (ix+0x05),0x00
  mem.write8(IX(0x09), 0x20);
  m.step(0x3825, 19); // ld (ix+0x09),0x20

  m.push16(0x3828);
  m.step(0x323a, 17); // call 0x323a
  m.call(0x323a);

  mem.write8(IX(0x0e), 0x00);
  m.step(0x382c, 19); // ld (ix+0x0e),0x00
  m.ret(); // 382c
}
