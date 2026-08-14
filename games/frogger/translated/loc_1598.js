// SPDX-License-Identifier: GPL-3.0-only

// loc_1598  (ROM 0x1598-0x163D) — object mover-RIGHT engine. IY = per-object phase byte, HL = lane
// control byte, DE = the object's OBJRAM run, IX = the object's leading sprite. Owns the shared
// continue-tails loc_15ab (apply the +C shift) and loc_15de (advance the object index).
export function loc_1598(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.iy);
  m.step(0x159b, 19); // ld a,(iy+0x00) -- the phase countdown
  regs.c = regs.a;
  m.step(0x159c, 4);
  regs.and(regs.a);
  m.step(0x159d, 4);
  if (regs.fNZ) {
    m.step(0x16d4, 10); // jp nz,0x16d4 -- phase pending, hand to the mover-LEFT tail
    return m.call(0x16d4);
  }
  m.step(0x15a0, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x15a1, 7); // ld a,(hl) -- lane control byte
  regs.b = regs.a;
  m.step(0x15a2, 4);
  regs.and(0x0f);
  m.step(0x15a4, 7); // and 0x0f -- low nibble = shift amount
  regs.c = regs.a;
  m.step(0x15a5, 4);
  regs.a = regs.b;
  m.step(0x15a6, 4);
  regs.and(0x10);
  m.step(0x15a8, 7); // and 0x10 -- bit4 = "phase set" flag
  if (regs.fNZ) {
    m.step(0x16d4, 10); // jp nz,0x16d4
    return m.call(0x16d4);
  }
  m.step(0x15ab, 10);
  return m.call(0x15ab); // fall through to loc_15ab
}

// loc_15ab  (ROM 0x15AB-0x15DD + 0x15EB-0x163D) — apply the +C rightward shift to the object's
// OBJRAM run and lead sprite, then the home-column / ride-off checks; falls into loc_15de.
export function loc_15ab(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.de);
  m.step(0x15ac, 7); // ld a,(de) -- run length
  regs.b = regs.a;
  m.step(0x15ad, 4);
  for (;;) {
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x15ae, 6);
    regs.a = mem.read8(regs.de);
    m.step(0x15af, 7);
    regs.add(regs.c);
    m.step(0x15b0, 4); // add a,c -- shift this sprite right
    mem.write8(regs.de, regs.a);
    m.step(0x15b1, 7);
    if (m.regs.djnz() !== 0) {
      m.step(0x15ad, 13);
      continue;
    }
    m.step(0x15b3, 8);
    break;
  }
  regs.a = mem.read8(regs.ix);
  m.step(0x15b6, 19); // ld a,(ix+0x00) -- lead X
  regs.add(regs.c);
  m.step(0x15b7, 4);
  mem.write8(regs.ix, regs.a);
  m.step(0x15ba, 19); // ld (ix+0x00),a
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x15bd, 19); // ld (ix+0x02),a
  regs.a = mem.read8(0x8047);
  m.step(0x15c0, 13); // ld a,(0x8047) -- frog X
  regs.cp(0x30);
  m.step(0x15c2, 7);
  if (regs.fC) {
    m.step(0x15da, 10); // jp c,0x15da
    return b_15da();
  }
  m.step(0x15c5, 10);
  regs.a = mem.read8(0x8047);
  m.step(0x15c8, 13);
  regs.cp(0x73);
  m.step(0x15ca, 7);
  if (regs.fNC) {
    m.step(0x15da, 10); // jp nc,0x15da -- frog off this lane's X window
    return b_15da();
  }
  m.step(0x15cd, 10);
  regs.b = regs.a;
  m.step(0x15ce, 4);
  regs.and(0x0f);
  m.step(0x15d0, 7); // and 0x0f -- frog column-within-cell
  regs.cp(0x03);
  m.step(0x15d2, 7);
  if (regs.fC) {
    m.step(0x15eb, 10); // jp c,0x15eb
    return b_15eb();
  }
  m.step(0x15d5, 10);
  regs.cp(0x0c);
  m.step(0x15d7, 7);
  if (regs.fNC) {
    m.step(0x161f, 10); // jp nc,0x161f
    return b_161f();
  }
  m.step(0x15da, 10);
  return b_15da();

  function b_15da() {
    mem.write8(regs.iy, 0x00);
    m.step(0x15de, 19); // ld (iy+0x00),0x00 -- clear the phase, fall into loc_15de
    return m.call(0x15de);
  }

  function b_15eb() {
    regs.a = regs.b;
    m.step(0x15ec, 4);
    regs.and(0xf0);
    m.step(0x15ee, 7); // and 0xf0 -- frog cell-column
    regs.exAf();
    m.step(0x15ef, 4); // ex af,af'
    regs.exAf();
    m.step(0x15f0, 4); // ex af,af'
    regs.sub(0x30);
    m.step(0x15f2, 7);
    regs.rrca();
    m.step(0x15f3, 4);
    regs.rrca();
    m.step(0x15f4, 4);
    regs.rrca();
    m.step(0x15f5, 4);
    regs.rrca();
    m.step(0x15f6, 4); // rrca x4 -- (cell-column - 0x30) >> 4
    regs.b = regs.a;
    m.step(0x15f7, 4);
    regs.a = mem.read8(0x80ff);
    m.step(0x15fa, 13); // ld a,(0x80ff) -- current object index
    regs.cp(regs.b);
    m.step(0x15fb, 4);
    if (regs.fNZ) {
      m.step(0x15da, 10); // jp nz,0x15da -- not this object's column
      return b_15da();
    }
    m.step(0x15fe, 10);
    regs.a = mem.read8(0x8047);
    m.step(0x1601, 13);
    regs.cp(0x30);
    m.step(0x1603, 7);
    if (regs.fC) {
      m.step(0x15da, 10); // jp c,0x15da
      return b_15da();
    }
    m.step(0x1606, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x1609, 13); // ld a,(0x8044) -- frog X while riding
    regs.add(regs.c);
    m.step(0x160a, 4); // add a,c -- carry the frog along
    mem.write8(0x8044, regs.a);
    m.step(0x160d, 13);
    regs.cp(0x08);
    m.step(0x160f, 7);
    if (regs.fC) {
      m.step(0x1617, 10); // jp c,0x1617 -- ran off the left edge
      return b_1617();
    }
    m.step(0x1612, 10);
    regs.cp(0xe7);
    m.step(0x1614, 7);
    if (regs.fC) {
      m.step(0x15da, 10); // jp c,0x15da -- ran off the right edge
      return b_15da();
    }
    m.step(0x1617, 10);
    return b_1617();
  }

  function b_1617() {
    regs.a = 0x01;
    m.step(0x1619, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x161c, 13); // ld (0x8004),a -- flag the frog lost (rode off-screen)
    m.step(0x15da, 10); // jp 0x15da
    return b_15da();
  }

  function b_161f() {
    regs.a = regs.b;
    m.step(0x1620, 4);
    regs.and(0xf0);
    m.step(0x1622, 7);
    regs.add(0x10);
    m.step(0x1624, 7); // add a,0x10 -- next cell-column
    regs.exAf();
    m.step(0x1625, 4); // ex af,af'
    regs.exAf();
    m.step(0x1626, 4); // ex af,af'
    regs.sub(0x30);
    m.step(0x1628, 7);
    regs.rrca();
    m.step(0x1629, 4);
    regs.rrca();
    m.step(0x162a, 4);
    regs.rrca();
    m.step(0x162b, 4);
    regs.rrca();
    m.step(0x162c, 4); // rrca x4
    regs.b = regs.a;
    m.step(0x162d, 4);
    regs.a = mem.read8(0x80ff);
    m.step(0x1630, 13); // ld a,(0x80ff)
    regs.cp(regs.b);
    m.step(0x1631, 4);
    if (regs.fNZ) {
      m.step(0x15da, 10); // jp nz,0x15da
      return b_15da();
    }
    m.step(0x1634, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x1637, 13); // ld a,(0x8044)
    regs.add(regs.c);
    m.step(0x1638, 4); // add a,c
    mem.write8(0x8044, regs.a);
    m.step(0x163b, 13);
    m.step(0x15da, 10); // jp 0x15da
    return b_15da();
  }
}

// loc_15de  (ROM 0x15DE-0x15EA) — advance the object index (0x80FF); loop back into the object
// dispatcher loc_14b7 while < 0x0B, else wrap the index to 0 and return.
export function loc_15de(m) {
  const { regs, mem } = m;

  regs.hl = 0x80ff;
  m.step(0x15e1, 10); // ld hl,0x80ff -- object index cell
  regs.incMem8(mem, regs.hl);
  m.step(0x15e2, 11); // inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x15e3, 7);
  regs.cp(0x0b);
  m.step(0x15e5, 7); // cp 0x0b -- 11 objects per lane
  if (regs.fC) {
    m.step(0x14b7, 10); // jp c,0x14b7 -- more objects to move
    return m.call(0x14b7);
  }
  m.step(0x15e8, 10);
  mem.write8(regs.hl, 0x00);
  m.step(0x15ea, 10); // ld (hl),0x00 -- wrap the index
  m.ret();
}
