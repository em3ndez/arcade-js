// SPDX-License-Identifier: GPL-3.0-only

// loc_0460  (ROM 0x0460-0x0495) -- render 10 rows x 3 cells from the 0x8e00 table into the
// 0x8567 panel. Each cell writes (ix) when non-zero, else the blank tile 0x40. Cells 1&2 step
// HL up one row (DE=0xffe0); the 3rd re-bases with DE=0x0042 to the next column. No calls.
export function loc_0460(m) {
  const { regs, mem } = m;

  regs.ix = 0x8e00;  m.step(0x0464, 14);
  regs.hl = 0x8567;  m.step(0x0467, 10);
  regs.b = 0x0a;     m.step(0x0469, 7);

  for (;;) { // 0x0469
    regs.de = 0xffe0;                      m.step(0x046c, 10);

    regs.a = mem.read8(regs.ix & 0xffff);  m.step(0x046f, 19);
    regs.and(regs.a);                      m.step(0x0470, 4);
    if (regs.fNZ) { m.step(0x0474, 12); }
    else { m.step(0x0472, 7); regs.a = 0x40; m.step(0x0474, 7); }
    mem.write8(regs.hl, regs.a);           m.step(0x0475, 7);
    regs.addHl(regs.de);                   m.step(0x0476, 11);
    regs.ix = (regs.ix + 1) & 0xffff;      m.step(0x0478, 10);

    regs.a = mem.read8(regs.ix & 0xffff);  m.step(0x047b, 19);
    regs.and(regs.a);                      m.step(0x047c, 4);
    if (regs.fNZ) { m.step(0x0480, 12); }
    else { m.step(0x047e, 7); regs.a = 0x40; m.step(0x0480, 7); }
    mem.write8(regs.hl, regs.a);           m.step(0x0481, 7);
    regs.addHl(regs.de);                   m.step(0x0482, 11);
    regs.ix = (regs.ix + 1) & 0xffff;      m.step(0x0484, 10);

    regs.a = mem.read8(regs.ix & 0xffff);  m.step(0x0487, 19);
    regs.and(regs.a);                      m.step(0x0488, 4);
    if (regs.fNZ) { m.step(0x048c, 12); }
    else { m.step(0x048a, 7); regs.a = 0x40; m.step(0x048c, 7); }
    mem.write8(regs.hl, regs.a);           m.step(0x048d, 7);
    regs.ix = (regs.ix + 1) & 0xffff;      m.step(0x048f, 10);
    regs.de = 0x0042;                      m.step(0x0492, 10);
    regs.addHl(regs.de);                   m.step(0x0493, 11);

    regs.b = (regs.b - 1) & 0xff; // djnz
    if (regs.b !== 0) { m.step(0x0469, 13); continue; }
    m.step(0x0495, 8); break;
  }

  m.ret(10);
}
