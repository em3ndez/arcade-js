// SPDX-License-Identifier: GPL-3.0-only
// loc_01ef  (ROM 0x01ef-0x01f4) -- `call 0x01ef` entry. Seeds HL=0x2142, then tail-jumps into
// the shared body loc_01f8 (which loc_01f5 also feeds, with HL=0x2242).
export function loc_01ef(m) {
  const { regs } = m;

  regs.hl = 0x2142; m.step(0x01f2, 10); // 01ef  lxi h,0x2142
  m.step(0x01f8, 10); return m.call(0x01f8); // 01f2  jmp 0x01f8 (tail)
}
