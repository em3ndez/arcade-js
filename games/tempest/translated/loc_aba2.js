// SPDX-License-Identifier: GPL-3.0-only
// loc_aba2  (ROM 0xaba2-0xabab) -- call loc_ac20, test $01c9&3: zero -> tail loc_ac07, else fall to loc_abac.
export function loc_aba2(m) {
  const { regs, mem } = m;
  m.push16(0xaba4); m.step(0xaba5, 6); m.call(0xac20);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xaba8, 4);
  regs.and(0x03); m.step(0xabaa, 2);
  if (regs.fZ) { m.step(0xac07, 4); return m.call(0xac07); }
  m.step(0xabac, 2); return m.call(0xabac);
}
