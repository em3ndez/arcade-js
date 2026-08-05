// SPDX-License-Identifier: GPL-3.0-only

// loc_2d21  (ROM 0x2D21–0x2D2C)
export function loc_2d21(m) {
  m.push16(0x2d24);
  m.step(0x2d6e, 17); // call 0x2d6e
  m.call(0x2d6e);

  m.push16(0x2d27);
  m.step(0x3058, 17); // call 0x3058
  m.call(0x3058);

  m.push16(0x2d2a);
  m.step(0x308a, 17); // call 0x308a
  m.call(0x308a);

  m.step(0x309b, 10); // jp 0x309b -- TAIL, 0x309b's ret returns to our caller
  return m.call(0x309b);
}
