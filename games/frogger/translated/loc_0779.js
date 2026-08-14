// SPDX-License-Identifier: GPL-3.0-only

// loc_0779  (ROM 0x0779-0x0780) — column-fill helper: write tile C into B consecutive tilemap
// cells from HL, leaving HL just past the run. BC=0x0a10 is count 0x0a | fill-tile 0x10.
export function loc_0779(m) {
  const { regs, mem } = m;

  regs.bc = 0x0a10;
  m.step(0x077c, 10);

  for (;;) {
    // loc_077c:
    mem.write8(regs.hl, regs.c);
    m.step(0x077d, 7); // ld (hl),c -- stamp the tile

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x077e, 6);

    if (m.regs.djnz() !== 0) {
      m.step(0x077c, 13);
      continue;
    }
    m.step(0x0780, 8);
    break;
  }

  m.ret();
}
