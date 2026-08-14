// SPDX-License-Identifier: GPL-3.0-only

// loc_0aba  (ROM 0x0ABA-0x0AED) — one-time display-field setup (guarded by (0x842D)): set (0x842D)=1,
// (0x803F)=3, (0x83E0)=0; blit a 4-tile strip (rst 0x28 from 0x2F6E to 0xA8BF); fill 0x0F rows of tile
// 0x0C down from 0xA8DF (+0x20); seed (0x83DC)=0x3C20 and (0x83DE)=0x60. Called from loc_0870.
export function loc_0aba(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x842d);
  m.step(0x0abd, 13);
  regs.or(regs.a);
  m.step(0x0abe, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x0abf, 5);

  regs.a = regs.inc8(regs.a);
  m.step(0x0ac0, 4);
  mem.write8(0x842d, regs.a);
  m.step(0x0ac3, 13); // (0x842d) = 1 -- laid out once
  regs.a = 0x03;
  m.step(0x0ac5, 7);
  mem.write8(0x803f, regs.a);
  m.step(0x0ac8, 13);
  regs.xor(regs.a);
  m.step(0x0ac9, 4);
  mem.write8(0x83e0, regs.a);
  m.step(0x0acc, 13);
  regs.hl = 0xa8bf;
  m.step(0x0acf, 10);
  regs.de = 0x2f6e;
  m.step(0x0ad2, 10);
  regs.b = 0x04;
  m.step(0x0ad4, 7);
  m.push16(0x0ad5);
  m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles up the column
  m.call(0x0028);

  regs.hl = 0xa8df;
  m.step(0x0ad8, 10);
  regs.de = 0x0020;
  m.step(0x0adb, 10);
  regs.bc = 0x0f0c;
  m.step(0x0ade, 10); // B=0x0f rows, C=0x0c fill tile

  for (;;) {
    // loc_0ade: fill one row
    mem.write8(regs.hl, regs.c);
    m.step(0x0adf, 7);
    regs.addHl(regs.de);
    m.step(0x0ae0, 11);
    if (m.regs.djnz() !== 0) {
      m.step(0x0ade, 13);
      continue;
    }
    m.step(0x0ae2, 8);
    break;
  }

  regs.hl = 0x3c20;
  m.step(0x0ae5, 10);
  mem.write16(0x83dc, regs.hl);
  m.step(0x0ae8, 16); // (0x83dc) = 0x3c20
  regs.a = 0x60;
  m.step(0x0aea, 7);
  mem.write8(0x83de, regs.a);
  m.step(0x0aed, 13); // (0x83de) = 0x60
  m.ret();
}
