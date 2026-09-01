// SPDX-License-Identifier: GPL-3.0-only
// loc_01f5  (ROM 0x01f5-0x01f7) -- `call 0x01f5` entry. Seeds HL=0x2242, then falls through into
// the shared body loc_01f8 (delegated as its own head; loc_01ef feeds it with HL=0x2142).
export function loc_01f5(m) {
  const { regs } = m;

  regs.hl = 0x2242; m.step(0x01f8, 10); // 01f5  lxi h,0x2242
  return m.call(0x01f8); // fall through into loc_01f8
}
