// SPDX-License-Identifier: GPL-3.0-only
// loc_af71  (ROM 0xaf71-0xaf76) -- clamp A to a max of 0x63 (BCD 99), then fall through into loc_af77.
export function loc_af71(m) {
  const { regs } = m;
  regs.cmp(0x63); m.step(0xaf73, 2);
  if (regs.fNC) { m.step(0xaf77, 3); return m.call(0xaf77); }
  m.step(0xaf75, 2);
  regs.a = 0x63; regs.setNZ(regs.a); m.step(0xaf77, 2);
  return m.call(0xaf77);
}
