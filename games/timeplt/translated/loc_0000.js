// SPDX-License-Identifier: GPL-3.0-only

// loc_0000  (ROM 0x0000-0x0002)
export function loc_0000(m) {
  m.step(0x07b1, 10); // jp 0x07b1
  return m.call(0x07b1);
}
