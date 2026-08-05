// SPDX-License-Identifier: GPL-3.0-only

// loc_2d2d  (ROM 0x2D2D-0x2D35)
export function loc_2d2d(m) {
  m.push16(0x2d30);
  m.step(0x2d6e, 17); // call 0x2d6e
  m.call(0x2d6e);

  m.push16(0x2d33);
  m.step(0x3058, 17); // call 0x3058
  m.call(0x3058);

  m.step(0x309b, 10); // jp 0x309b -- TAIL transfer
  return m.call(0x309b);
}
