// SPDX-License-Identifier: GPL-3.0-only

// loc_2d15  (ROM 0x2D15-0x2D20)
export function loc_2d15(m) {
  m.push16(0x2d18);
  m.step(0x2d6e, 17); // call 0x2d6e
  m.call(0x2d6e);

  m.push16(0x2d1b);
  m.step(0x3058, 17); // call 0x3058
  m.call(0x3058);

  m.push16(0x2d1e);
  m.step(0x3058, 17); // call 0x3058
  m.call(0x3058);

  m.step(0x309b, 10); // jp 0x309b -- TAIL transfer
  return m.call(0x309b);
}
