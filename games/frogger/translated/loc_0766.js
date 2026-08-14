// SPDX-License-Identifier: GPL-3.0-only

// loc_0766  (ROM 0x0766-0x0778) — fill a 0x1C-wide, 0x20-tall block of the tilemap starting at
// 0xA802 with tile 0x10 (E), stepping the write pointer past 4 columns (BC=0x0004) after each row.
export function loc_0766(m) {
  const { regs, mem } = m;

  regs.hl = 0xa802;
  m.step(0x0769, 10);

  regs.de = 0x2010;
  m.step(0x076c, 10); // D=0x20 row count, E=0x10 fill tile

  regs.c = 0x04;
  m.step(0x076e, 7);

  for (;;) {
    // loc_076e: one row
    regs.b = 0x1c;
    m.step(0x0770, 7); // B=0x1C tiles per row

    for (;;) {
      // loc_0770: write one tile
      mem.write8(regs.hl, regs.e);
      m.step(0x0771, 7);

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0772, 6);

      if (m.regs.djnz() !== 0) {
        m.step(0x0770, 13);
        continue;
      }
      m.step(0x0774, 8);
      break;
    }

    regs.addHl(regs.bc);
    m.step(0x0775, 11); // add hl,bc -- B=0 after djnz, C=0x04 -> skip 4 columns to the next row

    regs.d = regs.dec8(regs.d);
    m.step(0x0776, 4);

    if (regs.fNZ) {
      m.step(0x076e, 12);
      continue;
    }
    m.step(0x0778, 7);
    break;
  }

  m.ret();
}
