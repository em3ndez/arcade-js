// SPDX-License-Identifier: GPL-3.0-only

// loc_5965  (ROM 0x5965-0x596A, Time Pilot)
export function loc_5965(m) {
  const { regs } = m;

  regs.hl = 0x2e3e;
  m.step(0x5968, 10); // ld hl,0x2e3e

  m.step(0x596e, 10); // jp 0x596e -- TAIL
  return m.call(0x596e);
}
