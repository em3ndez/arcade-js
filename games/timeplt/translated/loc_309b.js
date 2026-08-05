// SPDX-License-Identifier: GPL-3.0-only

// loc_309b  (ROM 0x309B-0x30A4, Time Pilot)
export function loc_309b(m) {
  const { regs } = m;

  regs.de = 0x0010;
  m.step(0x309e, 10); // ld de,0x0010
  regs.addIx(regs.de);
  m.step(0x30a0, 15); // add ix,de -- next 0x10-byte record
  regs.iy = regs.iy + 1;
  m.step(0x30a2, 10); // inc iy
  regs.iy = regs.iy + 1;
  m.step(0x30a4, 10); // inc iy -- stride 2

  m.ret(10); // 30a4  ret
}
