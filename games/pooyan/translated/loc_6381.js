// SPDX-License-Identifier: GPL-3.0-only

// loc_6381  (ROM 0x6381-0x6389) -- scan setup: seed IX=0x887c, B=3, HL=0x8be8, then
// fall through into loc_638a (the per-object collision-scan loop over those three slots).
export function loc_6381(m) {
  const { regs } = m;

  regs.ix = 0x887c;    m.step(0x6385, 14);
  regs.b = 0x03;       m.step(0x6387, 7);
  regs.hl = 0x8be8;    m.step(0x638a, 10);
  return m.call(0x638a); // fall through into loc_638a
}
