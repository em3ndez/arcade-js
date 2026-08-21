// SPDX-License-Identifier: GPL-3.0-only

// loc_69c6  (ROM 0x69c6-0x6a0e) -- paired ix/iy object descent step. Rets unless (ix+0) active and
// (ix+2)==0. Runs the sequencer loc_4006, then decrements two 16-bit positions by their (+9) delta:
// (iy+5) low / (iy+6) high, then (ix+5) low / (ix+6) high (a borrow out of the low byte decrements the
// high byte). On the high byte (ix+6): ==6 bumps the 0x892b gate (inc only while it reads 0), ==0 wipes
// both 0x18-byte records via rst 0x10 (loc_0010) at ix and iy.
export function loc_69c6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0) & 0xffff);   m.step(0x69c9, 19);
  regs.and(regs.a);                             m.step(0x69ca, 4);
  if (regs.fZ) { m.ret(11); return; }           // 69ca  ret z -- record inactive
  m.step(0x69cb, 5);

  regs.a = mem.read8((regs.ix + 2) & 0xffff);   m.step(0x69ce, 19);
  regs.and(regs.a);                             m.step(0x69cf, 4);
  if (regs.fNZ) { m.ret(11); return; }          // 69cf  ret nz -- sub-state busy
  m.step(0x69d0, 5);

  m.push16(0x69d3); m.step(0x4006, 17); m.call(0x4006); // sequencer

  regs.a = mem.read8((regs.iy + 5) & 0xffff);   m.step(0x69d6, 19);
  regs.sub(mem.read8((regs.iy + 9) & 0xffff));  m.step(0x69d9, 19);
  if (regs.fNC) {
    m.step(0x69de, 12);
  } else {
    m.step(0x69db, 7);
    regs.decMem8(mem, (regs.iy + 6) & 0xffff);  m.step(0x69de, 23); // borrow -> dec high byte
  }
  mem.write8((regs.iy + 5) & 0xffff, regs.a);   m.step(0x69e1, 19);

  regs.a = mem.read8((regs.ix + 5) & 0xffff);   m.step(0x69e4, 19);
  regs.sub(mem.read8((regs.ix + 9) & 0xffff));  m.step(0x69e7, 19);
  if (regs.fNC) {
    m.step(0x69ec, 12);
  } else {
    m.step(0x69e9, 7);
    regs.decMem8(mem, (regs.ix + 6) & 0xffff);  m.step(0x69ec, 23); // borrow -> dec high byte
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);   m.step(0x69ef, 19);

  regs.a = mem.read8((regs.ix + 6) & 0xffff);   m.step(0x69f2, 19); // high byte of the ix position
  regs.cp(0x06);                                m.step(0x69f4, 7);
  if (regs.fNZ) {
    m.step(0x69fe, 12);
    regs.cp(0x01);                              m.step(0x6a00, 7);
    if (regs.fNC) { m.ret(11); return; }        // 6a00  ret nc -- high byte still >= 1
    m.step(0x6a01, 5);

    regs.xor(regs.a);                           m.step(0x6a02, 4);
    m.push16(regs.ix); m.step(0x6a04, 15);      // push ix
    regs.hl = m.pop16(); m.step(0x6a05, 10);    // pop hl -- HL = IX
    regs.b = 0x18;                              m.step(0x6a07, 7);
    m.push16(0x6a08); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- wipe 0x18 bytes at ix
    m.push16(regs.iy); m.step(0x6a0a, 15);      // push iy
    regs.hl = m.pop16(); m.step(0x6a0b, 10);    // pop hl -- HL = IY
    regs.b = 0x18;                              m.step(0x6a0d, 7);
    m.push16(0x6a0e); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- wipe 0x18 bytes at iy
    return m.ret(10);                           // 6a0e  ret
  }
  m.step(0x69f6, 7);

  regs.hl = 0x892b;                             m.step(0x69f9, 10);
  regs.a = mem.read8(regs.hl);                  m.step(0x69fa, 7);
  regs.and(regs.a);                             m.step(0x69fb, 4);
  if (regs.fNZ) { m.ret(11); return; }          // 69fb  ret nz -- gate already set
  m.step(0x69fc, 5);
  regs.incMem8(mem, regs.hl);                   m.step(0x69fd, 11); // inc (0x892b)
  return m.ret(10);                             // 69fd  ret
}
