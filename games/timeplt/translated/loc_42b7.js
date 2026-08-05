// SPDX-License-Identifier: GPL-3.0-only

// loc_42b7  (ROM 0x42B7-0x43B6, Time Pilot)
export function loc_42b7(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.d = mem.read8(Y(0x31));
  m.step(0x42ba, 19); // ld d,(iy+0x31) -- the spawner's coordinates
  regs.e = mem.read8(X(0x03));
  m.step(0x42bd, 19); // ld e,(ix+0x03)
  regs.h = mem.read8(Y(0x00));
  m.step(0x42c0, 19); // ld h,(iy+0x00)
  regs.l = mem.read8(X(0x05));
  m.step(0x42c3, 19); // ld l,(ix+0x05)
  regs.exx();
  m.step(0x42c4, 4); // exx

  m.push16(regs.ix);
  m.step(0x42c6, 15); // push ix -- the spawner's record
  m.push16(regs.iy);
  m.step(0x42c8, 15); // push iy
  regs.ix = mem.read16(0xa991);
  m.step(0x42cc, 20); // ld ix,(0xa991) -- the free slot loc_4243 found
  regs.iy = mem.read16(0xa993);
  m.step(0x42d0, 20); // ld iy,(0xa993)
  regs.exx();
  m.step(0x42d1, 4); // exx -- D/E/H/L are back; from here IX/IY are the NEW object

  mem.write8(X(0x03), regs.e);
  m.step(0x42d4, 19); // ld (ix+0x03),e
  mem.write8(Y(0x31), regs.d);
  m.step(0x42d7, 19); // ld (iy+0x31),d
  mem.write8(X(0x05), regs.l);
  m.step(0x42da, 19); // ld (ix+0x05),l
  mem.write8(Y(0x00), regs.h);
  m.step(0x42dd, 19); // ld (iy+0x00),h
  mem.write8(X(0x01), regs.c);
  m.step(0x42e0, 19); // ld (ix+0x01),c

  regs.a = mem.read8(0xad04);
  m.step(0x42e3, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x42e5, 7); // cp 0x04

  let label;
  if (regs.fZ) {
    m.step(0x43ae, 10); // jp z,0x43ae taken
    label = 0x43ae;
  } else {
    m.step(0x42e8, 10); // jp z NOT taken
    regs.and(regs.a); // A still holds (0xAD04) -- `cp` left it alone
    m.step(0x42e9, 4); // and a
    if (regs.fNZ) {
      m.step(0x4313, 10); // jp nz,0x4313 taken
      label = 0x4313;
    } else {
      m.step(0x42ec, 10); // jp nz NOT taken
      label = 0x42ec;
    }
  }

  if (label === 0x42ec) {
    mem.write8(Y(0x01), 0x4f);
    m.step(0x42f0, 19); // ld (iy+0x01),0x4f
    regs.a = regs.c;
    m.step(0x42f1, 4); // ld a,c
    regs.rrca();
    m.step(0x42f2, 4); // rrca
    regs.a = regs.sra(regs.a);
    m.step(0x42f4, 8); // sra a
    regs.and(0xc0);
    m.step(0x42f6, 7); // and 0xc0 -- rrca then sra a leave only C's bit 0, in bits 7 and 6
    regs.add(0x0b);
    m.step(0x42f8, 7); // add a,0x0b
    mem.write8(Y(0x30), regs.a);
    m.step(0x42fb, 19); // ld (iy+0x30),a
    mem.write8(X(0x07), 0x00);
    m.step(0x42ff, 19); // ld (ix+0x07),0x00
    mem.write8(X(0x08), 0xff);
    m.step(0x4303, 19); // ld (ix+0x08),0xff
    regs.decMem8(mem, X(0x00));
    m.step(0x4306, 23); // dec (ix+0x00)
    regs.a = mem.read8(0xa8f6);
    m.step(0x4309, 13); // ld a,(0xa8f6)
    mem.write8(0xa8f4, regs.a);
    m.step(0x430c, 13); // ld (0xa8f4),a -- re-arm the spawn cooldown
    regs.iy = m.pop16();
    m.step(0x430e, 14); // pop iy
    regs.ix = m.pop16();
    m.step(0x4310, 14); // pop ix

    m.step(0x5664, 10); // jp 0x5664 -- TAIL
    return m.call(0x5664);
  }

  if (label === 0x43ae) {
    regs.a = mem.read8(0xa8e6);
    m.step(0x43b1, 13); // ld a,(0xa8e6)
    mem.write8(X(0x04), regs.a);
    m.step(0x43b4, 19); // ld (ix+0x04),a
    m.step(0x4313, 10); // jp 0x4313 -- and on into the shared tail
  }

  regs.a = mem.read8(0xad04);
  m.step(0x4316, 13); // ld a,(0xad04)
  regs.cp(0x03);
  m.step(0x4318, 7); // cp 0x03

  if (regs.fZ) {
    m.step(0x436f, 10); // jp z,0x436f taken

    m.push16(regs.bc);
    m.step(0x4370, 11); // push bc
    regs.a = regs.c;
    m.step(0x4371, 4); // ld a,c
    regs.add(0x40);
    m.step(0x4373, 7); // add a,0x40
    regs.and(0x80);
    m.step(0x4375, 7); // and 0x80 -- which half of the circle C lies in
    regs.a = regs.c; // flag-neutral: the `jr nz` below still reads `and 0x80`'s Z
    m.step(0x4376, 4); // ld a,c

    if (regs.fNZ) {
      m.step(0x437f, 12); // jr nz,0x437f taken
      regs.sub(0x1a);
      m.step(0x4381, 7); // sub 0x1a
      mem.write8(X(0x02), regs.a);
      m.step(0x4384, 19); // ld (ix+0x02),a
    } else {
      m.step(0x4378, 7); // jr nz NOT taken
      regs.add(0x1a);
      m.step(0x437a, 7); // add a,0x1a
      mem.write8(X(0x02), regs.a);
      m.step(0x437d, 19); // ld (ix+0x02),a
      m.step(0x4384, 12); // jr 0x4384
    }

    m.push16(0x4387);
    m.step(0x598e, 17); // call 0x598e -- vector lookup on the offset heading
    m.call(0x598e);
    mem.write8(X(0x0a), regs.e);
    m.step(0x438a, 19); // ld (ix+0x0a),e
    mem.write8(X(0x0b), regs.d);
    m.step(0x438d, 19); // ld (ix+0x0b),d
    mem.write8(X(0x0c), regs.c);
    m.step(0x4390, 19); // ld (ix+0x0c),c
    mem.write8(X(0x0d), regs.b);
    m.step(0x4393, 19); // ld (ix+0x0d),b
    regs.bc = m.pop16();
    m.step(0x4394, 10); // pop bc -- C is the unoffset heading again
    mem.write8(X(0x02), regs.c);
    m.step(0x4397, 19); // ld (ix+0x02),c
    m.push16(0x439a);
    m.step(0x3faf, 17); // call 0x3faf
    m.call(0x3faf);
    mem.write8(X(0x0e), 0x20);
    m.step(0x439e, 19); // ld (ix+0x0e),0x20
    regs.decMem8(mem, X(0x00));
    m.step(0x43a1, 23); // dec (ix+0x00)
    regs.a = mem.read8(0xa8f6);
    m.step(0x43a4, 13); // ld a,(0xa8f6)
    mem.write8(0xa8f4, regs.a);
    m.step(0x43a7, 13); // ld (0xa8f4),a
    regs.iy = m.pop16();
    m.step(0x43a9, 14); // pop iy
    regs.ix = m.pop16();
    m.step(0x43ab, 14); // pop ix

    m.step(0x566e, 10); // jp 0x566e -- TAIL
    return m.call(0x566e);
  }
  m.step(0x431b, 10); // jp z NOT taken

  if (regs.fNC) {
    m.step(0x434c, 10); // jp nc,0x434c taken -- carry still from `cp 0x03`

    regs.hl = 0xac7f;
    m.step(0x434f, 10); // ld hl,0xac7f
    m.push16(0x4352);
    m.step(0x33b8, 17); // call 0x33b8 -- returns a byte in A
    m.call(0x33b8);
    mem.write8(X(0x01), regs.a);
    m.step(0x4355, 19); // ld (ix+0x01),a
    mem.write8(X(0x02), regs.a);
    m.step(0x4358, 19); // ld (ix+0x02),a
    m.push16(0x435b);
    m.step(0x3faf, 17); // call 0x3faf
    m.call(0x3faf);
    regs.decMem8(mem, X(0x00));
    m.step(0x435e, 23); // dec (ix+0x00)
    regs.a = mem.read8(0xa8f6);
    m.step(0x4361, 13); // ld a,(0xa8f6)
    mem.write8(0xa8f4, regs.a);
    m.step(0x4364, 13); // ld (0xa8f4),a
    mem.write8(X(0x0e), 0x00);
    m.step(0x4368, 19); // ld (ix+0x0e),0x00
    regs.iy = m.pop16();
    m.step(0x436a, 14); // pop iy
    regs.ix = m.pop16();
    m.step(0x436c, 14); // pop ix

    m.step(0x5674, 10); // jp 0x5674 -- TAIL
    return m.call(0x5674);
  }
  m.step(0x431e, 10); // jp nc NOT taken

  regs.hl = 0xac7f;
  m.step(0x4321, 10); // ld hl,0xac7f
  m.push16(0x4324);
  m.step(0x33b8, 17); // call 0x33b8 -- returns a byte in A
  m.call(0x33b8);
  mem.write8(X(0x01), regs.a);
  m.step(0x4327, 19); // ld (ix+0x01),a
  regs.a = mem.read8(X(0x0f));
  m.step(0x432a, 19); // ld a,(ix+0x0f)
  regs.rrca();
  m.step(0x432b, 4); // rrca
  regs.and(0x80);
  m.step(0x432d, 7); // and 0x80 -- +/- half a turn, from bit 0 of (ix+0x0f)
  regs.add(0x40);
  m.step(0x432f, 7); // add a,0x40
  regs.add(mem.read8(X(0x01)));
  m.step(0x4332, 19); // add a,(ix+0x01)
  mem.write8(X(0x02), regs.a);
  m.step(0x4335, 19); // ld (ix+0x02),a
  m.push16(0x4338);
  m.step(0x3faf, 17); // call 0x3faf
  m.call(0x3faf);
  regs.decMem8(mem, X(0x00));
  m.step(0x433b, 23); // dec (ix+0x00)
  regs.a = mem.read8(0xa8f6);
  m.step(0x433e, 13); // ld a,(0xa8f6)
  mem.write8(0xa8f4, regs.a);
  m.step(0x4341, 13); // ld (0xa8f4),a
  mem.write8(X(0x0e), 0x00);
  m.step(0x4345, 19); // ld (ix+0x0e),0x00
  regs.iy = m.pop16();
  m.step(0x4347, 14); // pop iy
  regs.ix = m.pop16();
  m.step(0x4349, 14); // pop ix

  m.step(0x566e, 10); // jp 0x566e -- TAIL
  return m.call(0x566e);
}
