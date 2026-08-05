// SPDX-License-Identifier: GPL-3.0-only

// loc_00b1  (ROM 0x00B1–0x00C6)
export function loc_00b1(m) {
  const { regs } = m;

  regs.hl = 0xa420;
  m.step(0x00b4, 10); // ld hl,0xa420
  regs.c = 0x0e;
  m.step(0x00b6, 7); // ld c,0x0e

  do {
    regs.de = 0x0020;
    m.step(0x00b9, 10); // ld de,0x0020
    regs.addHl(regs.de);
    m.step(0x00ba, 11); // add hl,de
    regs.b = 0x10;
    m.step(0x00bc, 7); // ld b,0x10

    do {
      m.push16(0x00bf);
      m.step(0x00c7, 17); // call 0x00c7
      m.call(0x00c7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x00c0, 6); // inc hl
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x00c1, 6); // inc hl
      regs.djnz(); // djnz -- no flags
      m.step(regs.b !== 0 ? 0x00bc : 0x00c3, regs.b !== 0 ? 13 : 8); // djnz 0x00bc
    } while (regs.b !== 0);

    regs.c = regs.dec8(regs.c);
    m.step(0x00c4, 4); // dec c
    m.step(regs.fNZ ? 0x00b6 : 0x00c6, regs.fNZ ? 12 : 7); // jr nz,0x00b6
  } while (regs.fNZ);

  m.ret(); // 0x00c6
}
