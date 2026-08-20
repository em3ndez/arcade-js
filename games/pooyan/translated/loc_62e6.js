// SPDX-License-Identifier: GPL-3.0-only

// loc_62e6  (ROM 0x62e6-0x630e) -- match-slot search + per-frame offset apply (bullet vs. slot).
// Entered by fall-through from the 0x62da prologue (IY=0x8ae0, A=(ix+0x14), C=0x06, DE=0x0018):
// scan up to 6 records for one whose (iy+0x14) tag equals A (self-loop, modelled as a JS loop).
// On the found/exhausted exit it adds a signed table[0x6360] delta (rst 0x20 index = (0x8907)&7 >>1)
// into (iy+0x0a), sets bit5 of (iy+0x16), then tail-jumps loc_6274 via the shared spawn at 0x5c75.
export function loc_62e6(m) {
  const { regs, mem } = m;

  for (;;) { // 62e6: cp the tag at (iy+0x14); advance IY by DE while the counter C survives
    regs.cp(mem.read8((regs.iy + 0x14) & 0xffff)); m.step(0x62e9, 19);
    if (regs.fZ) { m.step(0x62f0, 12); break; }    // jr z -- match found
    m.step(0x62eb, 7);
    regs.addIy(regs.de);        m.step(0x62ed, 15);
    regs.c = regs.dec8(regs.c); m.step(0x62ee, 4);
    if (regs.fNZ) { m.step(0x62e6, 12); continue; } // jr nz -- next record
    m.step(0x62f0, 7);          // counter spent -> exit
    break;
  }

  regs.hl = 0x6360;             m.step(0x62f3, 10);
  regs.a = mem.read8(0x8907);   m.step(0x62f6, 13);
  regs.and(0x07);               m.step(0x62f8, 7);
  regs.rra();                   m.step(0x62f9, 4);
  m.push16(0x62fa);
  m.step(0x0020, 11);           // rst 0x20 -- A = table[0x6360 + A]
  m.call(0x0020);
  regs.l = regs.a;              m.step(0x62fb, 4);
  regs.a = mem.read8((regs.iy + 0x0a) & 0xffff); m.step(0x62fe, 19);
  regs.add(regs.l);             m.step(0x62ff, 4);
  mem.write8((regs.iy + 0x0a) & 0xffff, regs.a);  m.step(0x6302, 19);
  const ea16 = (regs.iy + 0x16) & 0xffff;
  mem.write8(ea16, mem.read8(ea16) | 0x20);       m.step(0x6306, 23); // set 5,(iy+0x16)
  regs.de = 0x634f;             m.step(0x6309, 10);
  m.push16(0x630c);
  m.step(0x5c75, 17);           // call 0x5c75
  m.call(0x5c75);
  m.step(0x6274, 10);           // jp 0x6274 (tail)
  return m.call(0x6274);
}
