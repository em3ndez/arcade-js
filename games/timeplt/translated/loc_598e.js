// SPDX-License-Identifier: GPL-3.0-only

// loc_598e  (ROM 0x598E-0x5993)
export function loc_598e(m) {
  const { regs } = m;

  regs.hl = 0x59d7;
  m.step(0x5991, 10); // ld hl,0x59d7
  m.step(0x599d, 10); // jp 0x599d -- tail-jump
  return m.call(0x599d);
}
