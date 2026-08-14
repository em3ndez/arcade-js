// SPDX-License-Identifier: GPL-3.0-only

// loc_163e  (ROM 0x163E-0x16D3 + 0x16E6-0x16F7) — object mover-LEFT engine. Mirror of mover-RIGHT
// (loc_1598) but subtracting C: IY = per-object phase byte, HL = lane control byte, DE = the object's
// OBJRAM run, IX = the object's leading sprite. Interior tail loc_16e6 is the phase-pending path.
export function loc_163e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.iy);
  m.step(0x1641, 19); // ld a,(iy+0x00) -- the phase countdown
  regs.c = regs.a;
  m.step(0x1642, 4);
  regs.and(regs.a);
  m.step(0x1643, 4);
  if (regs.fNZ) {
    m.step(0x16e6, 10); // jp nz,0x16e6 -- phase pending
    return b_16e6();
  }
  m.step(0x1646, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x1647, 7); // ld a,(hl) -- lane control byte
  regs.b = regs.a;
  m.step(0x1648, 4);
  regs.and(0x0f);
  m.step(0x164a, 7); // and 0x0f -- low nibble = shift amount
  regs.c = regs.a;
  m.step(0x164b, 4);
  regs.a = regs.b;
  m.step(0x164c, 4);
  regs.and(0x10);
  m.step(0x164e, 7); // and 0x10 -- bit4 = "phase set" flag
  if (regs.fNZ) {
    m.step(0x16e6, 10); // jp nz,0x16e6
    return b_16e6();
  }
  m.step(0x1651, 10);
  return b_1651();

  function b_1651() {
    regs.a = mem.read8(regs.de);
    m.step(0x1652, 7); // ld a,(de) -- run length
    regs.b = regs.a;
    m.step(0x1653, 4);
    for (;;) {
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x1654, 6);
      regs.a = mem.read8(regs.de);
      m.step(0x1655, 7);
      regs.sub(regs.c);
      m.step(0x1656, 4); // sub c -- shift this sprite left
      mem.write8(regs.de, regs.a);
      m.step(0x1657, 7);
      if (m.regs.djnz() !== 0) {
        m.step(0x1653, 13);
        continue;
      }
      m.step(0x1659, 8);
      break;
    }
    regs.a = mem.read8(regs.ix);
    m.step(0x165c, 19); // ld a,(ix+0x00) -- lead X
    regs.sub(regs.c);
    m.step(0x165d, 4);
    mem.write8(regs.ix, regs.a);
    m.step(0x1660, 19); // ld (ix+0x00),a
    mem.write8((regs.ix + 2) & 0xffff, regs.a);
    m.step(0x1663, 19); // ld (ix+0x02),a
    regs.a = mem.read8(0x8047);
    m.step(0x1666, 13); // ld a,(0x8047) -- frog X
    regs.cp(0x73);
    m.step(0x1668, 7);
    if (regs.fNC) {
      m.step(0x1678, 10); // jp nc,0x1678 -- frog off this lane's X window
      return b_1678();
    }
    m.step(0x166b, 10);
    regs.b = regs.a;
    m.step(0x166c, 4);
    regs.and(0x0f);
    m.step(0x166e, 7); // and 0x0f -- frog column-within-cell
    regs.cp(0x03);
    m.step(0x1670, 7);
    if (regs.fC) {
      m.step(0x1689, 10); // jp c,0x1689
      return b_1689();
    }
    m.step(0x1673, 10);
    regs.cp(0x0c);
    m.step(0x1675, 7);
    if (regs.fNC) {
      m.step(0x16b5, 10); // jp nc,0x16b5
      return b_16b5();
    }
    m.step(0x1678, 10);
    return b_1678();
  }

  function b_1678() {
    mem.write8(regs.iy, 0x00);
    m.step(0x167c, 19); // ld (iy+0x00),0x00 -- clear the phase, fall into loc_167c
    return b_167c();
  }

  function b_167c() {
    regs.hl = 0x80ff;
    m.step(0x167f, 10); // ld hl,0x80ff -- object index cell
    regs.incMem8(mem, regs.hl);
    m.step(0x1680, 11); // inc (hl)
    regs.a = mem.read8(regs.hl);
    m.step(0x1681, 7);
    regs.cp(0x0b);
    m.step(0x1683, 7); // cp 0x0b -- 11 objects per lane
    if (regs.fC) {
      m.step(0x14b7, 10); // jp c,0x14b7 -- more objects to move
      return m.call(0x14b7);
    }
    m.step(0x1686, 10);
    mem.write8(regs.hl, 0x00);
    m.step(0x1688, 10); // ld (hl),0x00 -- wrap the index
    m.ret();
  }

  function b_1689() {
    regs.a = regs.b;
    m.step(0x168a, 4);
    regs.and(0xf0);
    m.step(0x168c, 7); // and 0xf0 -- frog cell-column
    regs.exAf();
    m.step(0x168d, 4); // ex af,af'
    regs.exAf();
    m.step(0x168e, 4); // ex af,af'
    regs.sub(0x30);
    m.step(0x1690, 7);
    regs.rrca();
    m.step(0x1691, 4);
    regs.rrca();
    m.step(0x1692, 4);
    regs.rrca();
    m.step(0x1693, 4);
    regs.rrca();
    m.step(0x1694, 4); // rrca x4 -- (cell-column - 0x30) >> 4
    regs.b = regs.a;
    m.step(0x1695, 4);
    regs.a = mem.read8(0x80ff);
    m.step(0x1698, 13); // ld a,(0x80ff) -- current object index
    regs.cp(regs.b);
    m.step(0x1699, 4);
    if (regs.fNZ) {
      m.step(0x1678, 10); // jp nz,0x1678 -- not this object's column
      return b_1678();
    }
    m.step(0x169c, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x169f, 13); // ld a,(0x8044) -- frog X while riding
    regs.sub(regs.c);
    m.step(0x16a0, 4); // sub c -- carry the frog along (left)
    mem.write8(0x8044, regs.a);
    m.step(0x16a3, 13);
    regs.cp(0x08);
    m.step(0x16a5, 7);
    if (regs.fC) {
      m.step(0x16ad, 10); // jp c,0x16ad -- ran off the left edge
      return b_16ad();
    }
    m.step(0x16a8, 10);
    regs.cp(0xe7);
    m.step(0x16aa, 7);
    if (regs.fC) {
      m.step(0x1678, 10); // jp c,0x1678 -- ran off the right edge
      return b_1678();
    }
    m.step(0x16ad, 10);
    return b_16ad();
  }

  function b_16ad() {
    regs.a = 0x01;
    m.step(0x16af, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x16b2, 13); // ld (0x8004),a -- flag the frog lost (rode off-screen)
    m.step(0x1678, 10); // jp 0x1678
    return b_1678();
  }

  function b_16b5() {
    regs.a = regs.b;
    m.step(0x16b6, 4);
    regs.and(0xf0);
    m.step(0x16b8, 7);
    regs.add(0x10);
    m.step(0x16ba, 7); // add a,0x10 -- next cell-column
    regs.exAf();
    m.step(0x16bb, 4); // ex af,af'
    regs.exAf();
    m.step(0x16bc, 4); // ex af,af'
    regs.sub(0x30);
    m.step(0x16be, 7);
    regs.rrca();
    m.step(0x16bf, 4);
    regs.rrca();
    m.step(0x16c0, 4);
    regs.rrca();
    m.step(0x16c1, 4);
    regs.rrca();
    m.step(0x16c2, 4); // rrca x4
    regs.b = regs.a;
    m.step(0x16c3, 4);
    regs.a = mem.read8(0x80ff);
    m.step(0x16c6, 13); // ld a,(0x80ff)
    regs.cp(regs.b);
    m.step(0x16c7, 4);
    if (regs.fNZ) {
      m.step(0x1678, 10); // jp nz,0x1678
      return b_1678();
    }
    m.step(0x16ca, 10);
    regs.a = mem.read8(0x8044);
    m.step(0x16cd, 13); // ld a,(0x8044)
    regs.sub(regs.c);
    m.step(0x16ce, 4); // sub c
    mem.write8(0x8044, regs.a);
    m.step(0x16d1, 13);
    m.step(0x1678, 10); // jp 0x1678
    return b_1678();
  }

  function b_16e6() {
    regs.a = regs.c;
    m.step(0x16e7, 4); // ld a,c -- the phase countdown
    regs.cp(0x01);
    m.step(0x16e9, 7);
    if (regs.fNZ) {
      m.step(0x16f1, 10); // jp nz,0x16f1
      return b_16f1();
    }
    m.step(0x16ec, 10);
    regs.c = 0x01;
    m.step(0x16ee, 7); // ld c,0x01 -- one-step move this frame
    m.step(0x1651, 10); // jp 0x1651
    return b_1651();
  }

  function b_16f1() {
    regs.c = regs.dec8(regs.c);
    m.step(0x16f2, 4); // dec c -- tick the phase down
    mem.write8(regs.iy, regs.c);
    m.step(0x16f5, 19); // ld (iy+0x00),c
    m.step(0x167c, 10); // jp 0x167c -- skip the move this frame
    return b_167c();
  }
}

// loc_16d4  (ROM 0x16D4-0x16E5) — mover-RIGHT phase-pending tail (loc_1598 jumps here). On the last
// phase tick force one step and re-enter loc_15ab; otherwise decrement the phase and re-enter loc_15de.
export function loc_16d4(m) {
  const { regs, mem } = m;

  regs.a = regs.c;
  m.step(0x16d5, 4); // ld a,c -- the phase countdown
  regs.cp(0x01);
  m.step(0x16d7, 7);
  if (regs.fNZ) {
    m.step(0x16df, 10); // jp nz,0x16df
    return b_16df();
  }
  m.step(0x16da, 10);
  regs.c = 0x01;
  m.step(0x16dc, 7); // ld c,0x01 -- one-step move this frame
  m.step(0x15ab, 10); // jp 0x15ab
  return m.call(0x15ab);

  function b_16df() {
    regs.c = regs.dec8(regs.c);
    m.step(0x16e0, 4); // dec c -- tick the phase down
    mem.write8(regs.iy, regs.c);
    m.step(0x16e3, 19); // ld (iy+0x00),c
    m.step(0x15de, 10); // jp 0x15de -- skip the move this frame
    return m.call(0x15de);
  }
}
