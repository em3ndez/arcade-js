// SPDX-License-Identifier: GPL-3.0-only

// loc_1410  (ROM 0x1410-0x1419) -- stash A into (ix+5), latch it in B, then branch on the frame/state
// byte (0x8901): below 3 -> jp 0x1399; otherwise fall through into loc_141c. Both exits are tails.
export function loc_1410(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x1413, 19);
  regs.b = regs.a;                               m.step(0x1414, 4);
  regs.a = mem.read8(0x8901);                    m.step(0x1417, 13);
  regs.cp(0x03);                                 m.step(0x1419, 7);
  if (regs.fC) { m.step(0x1399, 10); return m.call(0x1399); } // jp c,0x1399 (tail)
  m.step(0x141c, 10);                            // jp c not taken -> fall through into loc_141c (tail)
  return m.call(0x141c);
}
