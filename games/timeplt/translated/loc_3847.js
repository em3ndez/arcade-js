// SPDX-License-Identifier: GPL-3.0-only

// loc_3847  (ROM 0x3847–0x3854)
export function loc_3847(m) {
  const { regs } = m;

  regs.de = 0xfff0;
  m.step(0x384a, 10); // ld de,0xfff0
  regs.addIx(regs.de);
  m.step(0x384c, 15); // add ix,de
  regs.iy = (regs.iy - 1) & 0xffff;
  m.step(0x384e, 10); // dec iy
  regs.iy = (regs.iy - 1) & 0xffff;
  m.step(0x3850, 10); // dec iy
  regs.b = regs.dec8(regs.b); // dec b -- SETS the Z the jp nz reads
  m.step(0x3851, 4); // dec b
  if (regs.fNZ) {
    m.step(0x37d6, 10); // jp nz,0x37d6 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x37d6);
  }
  m.step(0x3854, 10); // jp nz NOT taken

  m.ret(); // 3854
}
