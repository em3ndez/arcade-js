// SPDX-License-Identifier: GPL-3.0-only

// loc_594e  (ROM 0x594E-0x5953, Time Pilot)
export function loc_594e(m) {
  const { regs } = m;

  regs.hl = 0x5e00;
  m.step(0x5951, 10); // ld hl,0x5e00

  m.step(0x596e, 10); // jp 0x596e -- TAIL
  return m.call(0x596e);
}
