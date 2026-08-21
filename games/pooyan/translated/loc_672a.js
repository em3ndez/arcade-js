// SPDX-License-Identifier: GPL-3.0-only

// loc_672a  (ROM 0x672a-0x679f) -- object descent step. Runs the animation sequencer loc_4006, then
// advances the 16-bit position (ix+5):(ix+6) by (ix+9). Until (ix+6) reaches 0x18 it scans the three
// 0x18-byte records at 0x8c48 for a free slot ((iy+1)==0) whose (iy+6) matches (ix+6): on a hit it
// bumps 0x8903, seats the slot (iy+1=2, coord fields from ix+3/ix+5, iy+0xf=0xc0), links it back into
// (ix+7/8), and sets the 0x8929 timer. Then (either arm) bumps state (ix+2), reloads (ix+9)=0x18 and
// tails loc_381e with de=0x3838.
export function loc_672a(m) {
  const { regs, mem } = m;

  m.push16(0x672d); m.step(0x4006, 17); m.call(0x4006);

  regs.a = mem.read8((regs.ix + 5) & 0xffff);       m.step(0x6730, 19);
  regs.add(mem.read8((regs.ix + 9) & 0xffff));      m.step(0x6733, 19);
  if (regs.fNC) {
    m.step(0x6738, 12);
  } else {
    m.step(0x6735, 7);
    regs.incMem8(mem, (regs.ix + 6) & 0xffff);      m.step(0x6738, 23); // inc (ix+6) -- carry
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);       m.step(0x673b, 19);
  regs.a = mem.read8((regs.ix + 6) & 0xffff);       m.step(0x673e, 19);
  regs.cp(0x18);                                    m.step(0x6740, 7);
  if (regs.fNC) {
    m.step(0x6792, 12); // (ix+6) >= 0x18 -> skip the slot scan
  } else {
    m.step(0x6742, 7);
    regs.iy = 0x8c48;                               m.step(0x6746, 14);
    regs.de = 0x0018;                               m.step(0x6749, 10);
    regs.b = 0x03;                                  m.step(0x674b, 7);

    for (;;) { // 674b: scan three records for a free slot matching (ix+6)
      regs.a = mem.read8((regs.iy + 1) & 0xffff);   m.step(0x674e, 19);
      regs.and(regs.a);                             m.step(0x674f, 4);
      if (regs.fNZ) {
        m.step(0x6759, 12); // slot busy
      } else {
        m.step(0x6751, 7);
        regs.a = mem.read8((regs.ix + 6) & 0xffff); m.step(0x6754, 19);
        regs.cp(mem.read8((regs.iy + 6) & 0xffff)); m.step(0x6757, 19);
        if (regs.fZ) { m.step(0x675e, 12); break; } // match -> seat it
        m.step(0x6759, 7);
      }
      regs.iy = regs.add16(regs.iy, regs.de);       m.step(0x675b, 15);
      if (regs.djnz() !== 0) { m.step(0x674b, 13); continue; }
      m.step(0x675d, 8);
      return m.ret(10); // 675d  ret -- no slot found
    }

    regs.hl = 0x8903;                               m.step(0x6761, 10);
    regs.incMem8(mem, regs.hl);                     m.step(0x6762, 11);
    mem.write8((regs.iy + 1) & 0xffff, 0x02);       m.step(0x6766, 19);
    regs.a = mem.read8((regs.ix + 3) & 0xffff);     m.step(0x6769, 19);
    regs.sub(0x80);                                 m.step(0x676b, 7);
    if (regs.fNC) {
      m.step(0x6770, 12);
    } else {
      m.step(0x676d, 7);
      regs.decMem8(mem, (regs.iy + 4) & 0xffff);    m.step(0x6770, 23); // borrow
    }
    mem.write8((regs.iy + 3) & 0xffff, regs.a);     m.step(0x6773, 19);
    regs.a = mem.read8((regs.ix + 5) & 0xffff);     m.step(0x6776, 19);
    regs.add(0x40);                                 m.step(0x6778, 7);
    if (regs.fNC) {
      m.step(0x677d, 12);
    } else {
      m.step(0x677a, 7);
      regs.decMem8(mem, (regs.iy + 6) & 0xffff);    m.step(0x677d, 23); // borrow
    }
    mem.write8((regs.iy + 5) & 0xffff, regs.a);     m.step(0x6780, 19);
    mem.write8((regs.iy + 0x0f) & 0xffff, 0xc0);    m.step(0x6784, 19);
    m.push16(regs.iy);                              m.step(0x6786, 15);
    regs.hl = m.pop16();                            m.step(0x6787, 10); // HL = IY
    mem.write8((regs.ix + 7) & 0xffff, regs.l);     m.step(0x678a, 19);
    mem.write8((regs.ix + 8) & 0xffff, regs.h);     m.step(0x678d, 19);
    regs.a = 0x20;                                  m.step(0x678f, 7);
    mem.write8(0x8929, regs.a);                     m.step(0x6792, 13);
  }

  regs.incMem8(mem, (regs.ix + 2) & 0xffff);        m.step(0x6795, 23);
  mem.write8((regs.ix + 9) & 0xffff, 0x18);         m.step(0x6799, 19);
  regs.de = 0x3838;                                 m.step(0x679c, 10);
  m.push16(0x679f); m.step(0x381e, 17); m.call(0x381e);
  m.ret(); // 679f  ret
}
