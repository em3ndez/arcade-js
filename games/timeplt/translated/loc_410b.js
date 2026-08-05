// SPDX-License-Identifier: GPL-3.0-only

// loc_410b  (ROM 0x410B-0x4116, Time Pilot)
export function loc_410b(m) {
  const { regs } = m;

  regs.de = 0x0010;
  m.step(0x410e, 10); // ld de,0x0010 -- the IX record stride
  regs.addIx(regs.de);
  m.step(0x4110, 15); // add ix,de
  regs.iy = (regs.iy + 1) & 0xffff;
  m.step(0x4112, 10); // inc iy
  regs.iy = (regs.iy + 1) & 0xffff;
  m.step(0x4114, 10); // inc iy -- the IY record stride is 2

  regs.djnz(); // affects NO flags
  if (regs.b !== 0) {
    m.step(0x40ea, 13); // djnz 0x40ea taken -- back edge into loc_40d6's loop head
    return m.call(0x40ea);
  }
  m.step(0x4116, 8); // djnz NOT taken

  m.ret(); // 0x4116 -- the whole loop's ret
}
