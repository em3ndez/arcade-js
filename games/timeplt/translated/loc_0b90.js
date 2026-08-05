// SPDX-License-Identifier: GPL-3.0-only

// loc_0b90  (ROM 0x0B90–0x0B92)
export function loc_0b90(m) {
  m.step(0x0b93, 10); // jp 0x0b93 -- TAIL transfer
  return m.call(0x0b93);
}
