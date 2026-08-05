// SPDX-License-Identifier: GPL-3.0-only

// loc_4108  (ROM 0x4108-0x4116)
export function loc_4108(m) {
  const { regs } = m;

  m.push16(0x410b);
  m.step(0x413c, 17); // call 0x413c
  m.call(0x413c);

  regs.de = 0x0010;
  m.step(0x410e, 10); // ld de,0x0010
  regs.addIx(regs.de);
  m.step(0x4110, 15); // add ix,de
  regs.iy = (regs.iy + 1) & 0xffff; // inc iy -- no flags
  m.step(0x4112, 10); // inc iy
  regs.iy = (regs.iy + 1) & 0xffff;
  m.step(0x4114, 10); // inc iy

  if (regs.djnz() !== 0) {
    m.step(0x40ea, 13); // djnz 0x40ea taken -- BACK EDGE into loc_40d6's loop head
    return m.call(0x40ea);
  }
  m.step(0x4116, 8); // djnz NOT taken

  m.ret(); // 4116
}
