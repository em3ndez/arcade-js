// SPDX-License-Identifier: GPL-3.0-only

// loc_4bd9  (ROM 0x4BD9–0x4BDB)
export function loc_4bd9(m) {
  m.step(0x08ae, 10); // jp 0x08ae -- TAIL transfer
  return m.call(0x08ae);
}
