// SPDX-License-Identifier: GPL-3.0-only

// loc_2d68  (ROM 0x2D68–0x2D6D)
export function loc_2d68(m) {
  m.push16(0x2d6b);
  m.step(0x2df4, 17); // call 0x2df4
  m.call(0x2df4);

  m.step(0x309b, 10);
  return m.call(0x309b);
}
