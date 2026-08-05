// SPDX-License-Identifier: GPL-3.0-only

// loc_1319  (ROM 0x1319-0x1322, Time Pilot)
export function loc_1319(m) {
  const { regs, mem } = m;

  regs.de = 0xffe0;
  m.step(0x131c, 10); // ld de,0xffe0 -- one tilemap row, backwards

  regs.b = 0x0d;
  m.step(0x131e, 7); // ld b,0x0d

  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x131f, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x1320, 11); // add hl,de -- HL -= 0x20

    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x131e : 0x1322, regs.b !== 0 ? 13 : 8); // djnz 0x131e
  } while (regs.b !== 0);

  m.ret(); // 1322  ret
}
