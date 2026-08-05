// SPDX-License-Identifier: GPL-3.0-only

// loc_181e  (ROM 0x181E-0x182F, Time Pilot)
export function loc_181e(m) {
  const { regs } = m;

  m.push16(0x1821);
  m.step(0x15b6, 17); // call 0x15b6
  m.call(0x15b6);

  regs.hl = 0xa5fc;
  m.step(0x1824, 10); // ld hl,0xa5fc
  regs.de = 0xacbe;
  m.step(0x1827, 10); // ld de,0xacbe

  m.push16(0x182a);
  m.step(0x1afc, 17); // call 0x1afc
  m.call(0x1afc);

  m.push16(0x182d);
  m.step(0x01b5, 17); // call 0x01b5
  m.call(0x01b5);

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, its ret goes to our caller
  return m.call(0x0f1a);
}
