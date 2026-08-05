// SPDX-License-Identifier: GPL-3.0-only

// loc_48be  (ROM 0x48BE–0x48CD)
export function loc_48be(m) {
  m.push16(0x48c1);
  m.step(0x48e7, 17); // call 0x48e7
  m.call(0x48e7);

  m.push16(0x48c4);
  m.step(0x4941, 17); // call 0x4941
  m.call(0x4941);

  m.push16(0x48c7);
  m.step(0x4911, 17); // call 0x4911
  m.call(0x4911);

  m.push16(0x48ca);
  m.step(0x4984, 17); // call 0x4984
  m.call(0x4984);

  m.push16(0x48cd);
  m.step(0x49d6, 17); // call 0x49d6
  m.call(0x49d6);

  m.ret(); // 0x48cd
}
