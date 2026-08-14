// SPDX-License-Identifier: GPL-3.0-only

// loc_0038  (ROM 0x0038-0x004E) — the rst 0x38 target: clear the 32x32 tilemap
// (0xA800-0xABFF) to tile 0x10 one 0x20-byte row at a time, with a per-row busy
// delay between rows.
export function loc_0038(m) {
  const { regs, mem } = m;

  regs.de = 0x2010;
  m.step(0x003b, 10); // ld de,0x2010 -- D=0x20 row count, E=0x10 fill tile

  regs.hl = 0xa800;
  m.step(0x003e, 10);

  for (;;) {
    // loc_003e:
    regs.b = 0x20;
    m.step(0x0040, 7);

    for (;;) {
      // loc_0040: write one row of 0x20 tiles
      mem.write8(regs.hl, regs.e);
      m.step(0x0041, 7);

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0042, 6);

      if (m.regs.djnz() !== 0) {
        m.step(0x0040, 13);
      } else {
        m.step(0x0044, 8);
        break;
      }
    }

    regs.c = 0x15;
    m.step(0x0046, 7);

    for (;;) {
      // loc_0046: nested busy delay (B=0 -> 256 inner spins per pass, C passes)
      if (m.regs.djnz() !== 0) {
        m.step(0x0046, 13); // djnz 0x0046 (taken)
        continue;
      }
      m.step(0x0048, 8);

      regs.c = regs.dec8(regs.c);
      m.step(0x0049, 4);

      if (regs.fNZ) {
        m.step(0x0046, 12);
      } else {
        m.step(0x004b, 7);
        break;
      }
    }

    regs.d = regs.dec8(regs.d);
    m.step(0x004c, 4);

    if (regs.fNZ) {
      m.step(0x003e, 12); // jr nz,0x003e (taken) -- next row
    } else {
      m.step(0x004e, 7); // jr nz,0x003e (not taken) -- all 0x20 rows done
      break;
    }
  }

  m.ret();
}
