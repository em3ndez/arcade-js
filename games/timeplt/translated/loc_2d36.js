// SPDX-License-Identifier: GPL-3.0-only

// loc_2d36  (ROM 0x2D36-0x2D3E, Time Pilot)
export function loc_2d36(m) {
  m.push16(0x2d39);
  m.step(0x2d93, 17); // call 0x2d93
  m.call(0x2d93);

  m.push16(0x2d3c);
  m.step(0x3058, 17); // call 0x3058
  m.call(0x3058);

  m.step(0x309b, 10);
  return m.call(0x309b);
}
