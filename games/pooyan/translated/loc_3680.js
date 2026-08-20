// SPDX-License-Identifier: GPL-3.0-only

// loc_3680  (ROM 0x3680-0x36db) -- scan the IY actor table (B entries, stride DE) for a free slot
// (rrca of (iy+0)|(iy+1) -> NC) and, when found, initialise it: bump the spawn counters at 0x8d7b/
// 0x8d79/0x8d41 (0x8d41 skips zero on wrap), pick the anim pointer (0x3988 or 0x3994 per (ix+7)
// bit1), seed (ix+2)/(ix+0e)/(ix+11)/(ix+14), then call 0x36de and tail-jp 0x379d. Table full -> ret.
export function loc_3680(m) {
  const { regs, mem } = m;

  for (;;) { // loc_3680: scan for a slot whose (iy+0)|(iy+1) has bit0 clear
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);   m.step(0x3683, 19);
    regs.or(mem.read8((regs.iy + 0x01) & 0xffff));   m.step(0x3686, 19);
    regs.rrca();                                     m.step(0x3687, 4);
    if (regs.fNC) { m.step(0x3696, 12); break; }     // jr nc -- free slot found
    m.step(0x3689, 7);
    regs.addIy(regs.de);                             m.step(0x368b, 15);
    if (regs.djnz()) { m.step(0x3680, 13); continue; }
    m.step(0x368d, 8);
    return m.ret(10);                                // table full -- no slot
  }

  // loc_3696: free slot found -- initialise it
  regs.bit(2, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x369a, 20);
  if (regs.fZ) {
    m.step(0x36af, 12);                              // jr z -- (ix+7) bit2 clear
  } else {
    m.step(0x369c, 7);
    regs.hl = 0x8d7b;                                m.step(0x369f, 10);
    regs.incMem8(mem, regs.hl);                      m.step(0x36a0, 11);
    regs.hl = 0x8d79;                                m.step(0x36a3, 10);
    regs.a = mem.read8(regs.hl);                     m.step(0x36a4, 7);
    regs.and(regs.a);                                m.step(0x36a5, 4);
    if (regs.fZ) {
      m.step(0x36af, 12);                            // jr z -- (0x8d79)==0
    } else {
      m.step(0x36a7, 7);
      regs.decMem8(mem, regs.hl);                    m.step(0x36a8, 11);
      regs.hl = 0x8d75;                              m.step(0x36ab, 10);
      mem.write8(regs.hl, regs.a);                   m.step(0x36ac, 7); // A = pre-dec (0x8d79)
      regs.l = regs.inc8(regs.l);                    m.step(0x36ad, 4); // inc l -> 0x8d76
      mem.write8(regs.hl, 0x00);                     m.step(0x36af, 10);
    }
  }

  // loc_36af: bump the slot-id counter, skipping 0 on wrap
  regs.hl = 0x8d41;                                  m.step(0x36b2, 10);
  regs.incMem8(mem, regs.hl);                        m.step(0x36b3, 11);
  if (regs.fNZ) {
    m.step(0x36b6, 12);                              // jr nz -- non-zero, keep it
  } else {
    m.step(0x36b5, 7);
    regs.incMem8(mem, regs.hl);                      m.step(0x36b6, 11); // wrapped to 0 -> inc again
  }

  // loc_36b6: seed the slot fields
  regs.c = mem.read8(regs.hl);                       m.step(0x36b7, 7);
  mem.write8((regs.ix + 0x14) & 0xffff, regs.c);     m.step(0x36ba, 19);
  regs.hl = 0x3988;                                  m.step(0x36bd, 10);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x36c1, 20);
  if (regs.fZ) {
    m.step(0x36c6, 12);                              // jr z -- (ix+7) bit1 clear, keep 0x3988
  } else {
    m.step(0x36c3, 7);
    regs.hl = 0x3994;                                m.step(0x36c6, 10);
  }

  // loc_36c6
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.l);     m.step(0x36c9, 19);
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.h);     m.step(0x36cc, 19);
  mem.write8((regs.ix + 0x0e) & 0xffff, 0x00);       m.step(0x36d0, 19);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x28);       m.step(0x36d4, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x04);       m.step(0x36d8, 19);
  m.push16(0x36db);
  m.step(0x36de, 17);                                // call 0x36de (boundary)
  m.call(0x36de);
  m.step(0x379d, 10);                                // jp 0x379d (tail)
  return m.call(0x379d);
}
