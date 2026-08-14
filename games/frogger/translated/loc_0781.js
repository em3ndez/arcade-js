// SPDX-License-Identifier: GPL-3.0-only

// loc_0781  (ROM 0x0781-0x0793) — fill a 0x16-wide, 0x20-tall block of VRAM from 0xA808 with tile
// 0x10 (E), skipping 0x0A columns (BC=0x000A) between rows. Called from the mode-3 intro (0x0BB3).
export function loc_0781(m) {
  const { regs, mem } = m;

  regs.hl = 0xa808;
  m.step(0x0784, 10);
  regs.de = 0x2010;
  m.step(0x0787, 10); // D=0x20 rows, E=0x10 fill tile
  regs.c = 0x0a;
  m.step(0x0789, 7);

  for (;;) {
    // loc_0789: one row
    regs.b = 0x16;
    m.step(0x078b, 7); // B=0x16 tiles per row

    for (;;) {
      // loc_078b: write one tile
      mem.write8(regs.hl, regs.e);
      m.step(0x078c, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x078d, 6);
      if (m.regs.djnz() !== 0) {
        m.step(0x078b, 13);
        continue;
      }
      m.step(0x078f, 8);
      break;
    }

    regs.addHl(regs.bc);
    m.step(0x0790, 11); // B=0 after djnz, C=0x0a -> skip 0x0a columns to the next row
    regs.d = regs.dec8(regs.d);
    m.step(0x0791, 4);
    if (regs.fNZ) {
      m.step(0x0789, 12);
      continue;
    }
    m.step(0x0793, 7);
    break;
  }

  m.ret();
}
