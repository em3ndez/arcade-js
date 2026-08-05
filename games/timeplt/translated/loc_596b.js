// SPDX-License-Identifier: GPL-3.0-only

// loc_596b  (ROM 0x596B-0x596D, Time Pilot)
export function loc_596b(m) {
  const { regs } = m;

  regs.hl = 0x08fa;
  m.step(0x596e, 10); // ld hl,0x08fa -- the next address IS 0x596e

  return m.call(0x596e); // FALL THROUGH; no jump, so no cycles charged for it
}
