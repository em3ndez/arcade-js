// SPDX-License-Identifier: GPL-3.0-only

// loc_7fa8  (ROM 0x7fa8-0x7fd5) -- shared tail (reached from loc_7f0e/loc_7f5d). Calls the sound
// helper 0x0ecf, then reads a count at (0x8e25): if nonzero it fills B rows with A=0x10 -- both a
// tile pointer (0x8e27, stepped by DE=0xffe0) and an IX record (0x8e1f, stepped +1) -- via a djnz
// loop at loc_7fbe. loc_7fc7 (also the jr-z target) latches (0x8808)=0x80, clears (0x8e26), sets
// (0x8e2a)=1, ret. `and a` at 0x7fae sets the Z the jr z tests.
export function loc_7fa8(m) {
  const { regs, mem } = m;

  m.push16(0x7fab); m.step(0x0ecf, 17); m.call(0x0ecf); // call 0x0ecf
  regs.a = mem.read8(0x8e25);   m.step(0x7fae, 13);
  regs.and(regs.a);             m.step(0x7faf, 4);
  if (regs.fZ) {
    m.step(0x7fc7, 12);                                  // jr z,0x7fc7 taken -> shared tail
  } else {
    m.step(0x7fb1, 7);                                   // jr z not taken
    regs.b = regs.a;            m.step(0x7fb2, 4);
    regs.a = 0x10;              m.step(0x7fb4, 7);
    regs.hl = mem.read16(0x8e27); m.step(0x7fb7, 16);
    regs.de = 0xffe0;          m.step(0x7fba, 10);
    regs.ix = mem.read16(0x8e1f); m.step(0x7fbe, 20);

    // loc_7fbe: djnz fill -- B iterations of (hl)=A, (ix+0)=A, hl+=DE, ix++
    for (;;) {
      mem.write8(regs.hl, regs.a);              m.step(0x7fbf, 7);
      mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x7fc2, 19);
      regs.addHl(regs.de);                      m.step(0x7fc3, 11);
      regs.ix = (regs.ix + 1) & 0xffff;         m.step(0x7fc5, 10);
      regs.b = (regs.b - 1) & 0xff; // djnz: dec b, no flags
      if (regs.b !== 0) { m.step(0x7fbe, 13); continue; }
      m.step(0x7fc7, 8); break;
    }
  }

  // loc_7fc7: shared tail
  regs.hl = 0x8808;            m.step(0x7fca, 10);
  mem.write8(regs.hl, 0x80);   m.step(0x7fcc, 10);
  regs.xor(regs.a);            m.step(0x7fcd, 4);
  mem.write8(0x8e26, regs.a);  m.step(0x7fd0, 13);
  regs.a = 0x01;               m.step(0x7fd2, 7);
  mem.write8(0x8e2a, regs.a);  m.step(0x7fd5, 13);
  m.ret(10); return;                                     // 7fd5  ret
}
