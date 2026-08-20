// SPDX-License-Identifier: GPL-3.0-only

// loc_1694  (ROM 0x1694-0x16ad) -- compare the 0xff-terminated pattern at 0x16ae against RAM at 0x89f0.
// On the first byte mismatch, tail-branch to loc_16b7 (the idx1 state handler, reusing this frame). If the
// whole pattern matches (0xff terminator reached), clear the 7-cell field at 0x89f0 via rst 0x10 (loc_0010)
// with A=0, then return.
export function loc_1694(m) {
  const { regs, mem } = m;

  regs.de = 0x16ae;                m.step(0x1697, 10);
  regs.hl = 0x89f0;                m.step(0x169a, 10);

  for (;;) { // loc_169a: compare pattern[DE] against RAM[HL]
    regs.a = mem.read8(regs.de);   m.step(0x169b, 7);
    regs.cp(0xff);                 m.step(0x169d, 7);
    if (regs.fZ) { m.step(0x16a6, 12); break; } // jr z -- 0xff terminator: full match
    m.step(0x169f, 7);            // jr z not taken
    regs.cp(mem.read8(regs.hl));   m.step(0x16a0, 7);
    if (regs.fNZ) {               // jr nz -- mismatch: tail-branch to loc_16b7 (no push16)
      m.step(0x16b7, 12);
      return m.call(0x16b7);
    }
    m.step(0x16a2, 7);            // jr nz not taken
    regs.de = (regs.de + 1) & 0xffff; m.step(0x16a3, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x16a4, 6);
    m.step(0x169a, 12);           // jr 0x169a
  }

  // loc_16a6: full match -> clear the 7-cell field at 0x89f0 via rst 0x10
  regs.hl = 0x89f0;               m.step(0x16a9, 10);
  regs.xor(regs.a);               m.step(0x16aa, 4);
  regs.b = 0x07;                  m.step(0x16ac, 7);
  m.push16(0x16ad);
  m.step(0x0010, 11);             // 16ac  rst 0x10 (fill helper 0x0010)
  m.call(0x0010);
  return m.ret(10);               // 16ad  ret
}
