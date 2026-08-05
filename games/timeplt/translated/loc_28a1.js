// SPDX-License-Identifier: GPL-3.0-only

// loc_28a1  (ROM 0x28A1–0x28B6)
export function loc_28a1(m) {
  m.push16(0x28a4);
  m.step(0x28b7, 17); // call 0x28b7
  m.call(0x28b7);

  m.push16(0x28a7);
  m.step(0x28c2, 17); // call 0x28c2
  m.call(0x28c2);

  m.push16(0x28aa);
  m.step(0x28cd, 17); // call 0x28cd
  m.call(0x28cd);

  m.push16(0x28ad);
  m.step(0x28d8, 17); // call 0x28d8
  m.call(0x28d8);

  m.push16(0x28b0);
  m.step(0x28e3, 17); // call 0x28e3
  m.call(0x28e3);

  m.push16(0x28b3);
  m.step(0x28ee, 17); // call 0x28ee
  m.call(0x28ee);

  m.push16(0x28b6);
  m.step(0x28fe, 17); // call 0x28fe
  m.call(0x28fe);

  m.ret(); // 28b6
}
