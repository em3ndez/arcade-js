// SPDX-License-Identifier: GPL-3.0-only

// loc_5942  (ROM 0x5942–0x5947)
export function loc_5942(m) {
  const { regs } = m;

  regs.hl = 0x59d7;
  m.step(0x5945, 10); // ld hl,0x59d7
  m.step(0x596e, 10); // jp 0x596e
  return m.call(0x596e);
}
