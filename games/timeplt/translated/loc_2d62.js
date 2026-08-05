// SPDX-License-Identifier: GPL-3.0-only

// loc_2d62  (ROM 0x2D62-0x2D67, Time Pilot)
export function loc_2d62(m) {
  m.push16(0x2d65);
  m.step(0x2d93, 17); // call 0x2d93
  m.call(0x2d93);

  m.step(0x309b, 10); // jp 0x309b -- TAIL jump, nothing pushed
  return m.call(0x309b);
}
