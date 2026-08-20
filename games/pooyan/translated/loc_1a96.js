// SPDX-License-Identifier: GPL-3.0-only

// loc_1a96  (ROM 0x1a96-0x1ab1) -- phase-exhausted handler: reached when loc_1a64's 0x8908 phase
// count hits 0. Calls loc_0f92, then bumps the 0x880a counter -- once for player 0, twice for
// player 1 (0x880d nonzero) -- clears 0x89fc / 0x8931 / 0x8932, tails a call to loc_1ab2, and rets.
export function loc_1a96(m) {
  const { regs, mem } = m;

  m.push16(0x1a99); m.step(0x0f92, 17); m.call(0x0f92);
  regs.hl = 0x880a;             m.step(0x1a9c, 10);
  regs.a = mem.read8(0x880d);   m.step(0x1a9f, 13);
  regs.and(regs.a);            m.step(0x1aa0, 4);
  if (regs.fZ) {
    m.step(0x1aa3, 12);          // player 0 -> skip the extra inc
  } else {
    m.step(0x1aa2, 7);
    regs.incMem8(mem, regs.hl);  m.step(0x1aa3, 11); // player 1 -> first inc (0x880a)
  }
  regs.incMem8(mem, regs.hl);    m.step(0x1aa4, 11);   // inc (0x880a)
  regs.xor(regs.a);            m.step(0x1aa5, 4);
  mem.write8(0x89fc, regs.a);   m.step(0x1aa8, 13);
  mem.write8(0x8931, regs.a);   m.step(0x1aab, 13);
  mem.write8(0x8932, regs.a);   m.step(0x1aae, 13);
  m.push16(0x1ab1); m.step(0x1ab2, 17); m.call(0x1ab2);
  return m.ret(10);
}
