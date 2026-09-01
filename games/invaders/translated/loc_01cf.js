// SPDX-License-Identifier: GPL-3.0-only
// loc_01cf  (ROM 0x01cf-0x01d8) -- called from 0x0804/0x0811/0x0b6e. Seats A=1, B=0xe0,
// HL=0x2402 then tail-jumps to the 0x14cc block-fill (delegated, not inlined).
export function loc_01cf(m) {
  const { regs } = m;

  regs.a = 0x01; m.step(0x01d1, 7);
  regs.b = 0xe0; m.step(0x01d3, 7);
  regs.hl = 0x2402; m.step(0x01d6, 10);
  m.step(0x14cc, 10); return m.call(0x14cc); // 01d6  jmp 0x14cc
}
