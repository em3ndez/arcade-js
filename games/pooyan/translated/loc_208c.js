// SPDX-License-Identifier: GPL-3.0-only

// loc_208c  (ROM 0x208c-0x20a9) -- table-match check. Walks 0x10 bytes of the DE table
// (0x20aa) against every 8th entry of the HL table (0x066d, HL += 8 per step via A). Any
// mismatch sets the flag (0x8ef0)=1 and returns early; a full match returns clean.
// Interior labels loc_2094 (loop head), loc_20a0, loc_20a4 are inlined. MAME execpcs
// confirms every boundary (208c 208f 2091 2094 2095 2096 2098 2099 209a 209c 209d 20a0 20a1 20a3).
export function loc_208c(m) {
  const { regs, mem } = m;

  regs.hl = 0x066d;         m.step(0x208f, 10);
  regs.b = 0x10;            m.step(0x2091, 7);
  regs.de = 0x20aa;         m.step(0x2094, 10);

  for (;;) {
    // loc_2094
    regs.a = mem.read8(regs.de);        m.step(0x2095, 7);
    regs.cp(mem.read8(regs.hl));        m.step(0x2096, 7); // cp (hl)
    if (regs.fNZ) {
      // loc_20a4: mismatch
      m.step(0x20a4, 12);              // jr nz taken
      regs.a = 0x01;                   m.step(0x20a6, 7);
      mem.write8(0x8ef0, regs.a);      m.step(0x20a9, 13);
      return m.ret();
    }
    m.step(0x2098, 7);                 // jr nz not taken
    regs.de = (regs.de + 1) & 0xffff;  m.step(0x2099, 6);
    m.step(0x209a, 4);                 // nop
    regs.a = 0x08;                     m.step(0x209c, 7);
    regs.add(regs.l);                  m.step(0x209d, 4); // add a,l
    if (regs.fNC) {
      m.step(0x20a0, 12);              // jr nc taken, skip inc h
    } else {
      m.step(0x209f, 7);
      regs.h = regs.inc8(regs.h);      m.step(0x20a0, 4);
    }
    // loc_20a0
    regs.l = regs.a;                   m.step(0x20a1, 4);
    if (regs.djnz() !== 0) { m.step(0x2094, 13); continue; }
    m.step(0x20a3, 8);
    break;
  }
  return m.ret();
}
