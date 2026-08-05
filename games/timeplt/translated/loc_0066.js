// SPDX-License-Identifier: GPL-3.0-only

// loc_0066  (ROM 0x0066-0x0068)
export function loc_0066(m) {
  m.step(0x00d8, 10); // jp 0x00d8 -- TAIL
  return m.call(0x00d8);
}
