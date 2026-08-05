// SPDX-License-Identifier: GPL-3.0-only

// loc_4afb  (ROM 0x4AFB-0x4B06, Time Pilot)
export function loc_4afb(m) {
  const { regs } = m;

  regs.c = 0x10;
  m.step(0x4afd, 7); // ld c,0x10
  regs.de = 0xa47f;
  m.step(0x4b00, 10); // ld de,0xa47f
  regs.hl = 0xa986;
  m.step(0x4b03, 10); // ld hl,0xa986

  m.push16(0x4b06);
  m.step(0x0d81, 17); // call 0x0d81
  m.call(0x0d81);

  m.ret(10); // ret
}
