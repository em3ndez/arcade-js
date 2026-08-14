// SPDX-License-Identifier: GPL-3.0-only

// loc_0629  (ROM 0x0629-0x064A) — clear + seed the score-display sprites: wipe the player's work RAM
// (loc_07e6), zero the two score-cursor bytes (0x839A/0x839B), set (0x83CC)=1, then run 0x20 passes
// laying two loc_0779 tile-fills per pass and stepping HL down the field. Also reached from loc_230f.
export function loc_0629(m) {
  const { regs, mem } = m;

  m.push16(0x062c);
  m.step(0x07e6, 17); // call 0x07e6 -- clear the player's work RAM
  m.call(0x07e6);

  regs.hl = 0x839a;
  m.step(0x062f, 10);

  regs.xor(regs.a);
  m.step(0x0630, 4); // A = 0

  mem.write8(regs.hl, regs.a);
  m.step(0x0631, 7); // (0x839a) = 0

  regs.l = regs.inc8(regs.l);
  m.step(0x0632, 4);

  mem.write8(regs.hl, regs.a);
  m.step(0x0633, 7); // (0x839b) = 0

  regs.a = regs.inc8(regs.a);
  m.step(0x0634, 4); // A = 1

  mem.write8(0x83cc, regs.a);
  m.step(0x0637, 13); // (0x83cc) = 1

  regs.a = 0x20;
  m.step(0x0639, 7); // outer pass count

  regs.hl = 0xa806;
  m.step(0x063c, 10);

  for (;;) {
    // loc_063c:
    m.push16(0x063f);
    m.step(0x0779, 17); // call 0x0779 -- fill this column
    m.call(0x0779);

    regs.l = regs.inc8(regs.l);
    m.step(0x0640, 4);

    regs.l = regs.inc8(regs.l);
    m.step(0x0641, 4); // skip 2 cells to the next column

    m.push16(0x0644);
    m.step(0x0779, 17); // call 0x0779 -- fill that column
    m.call(0x0779);

    regs.c = 0x0a;
    m.step(0x0646, 7);

    regs.addHl(regs.bc);
    m.step(0x0647, 11); // step HL down to the next field row

    regs.a = regs.dec8(regs.a);
    m.step(0x0648, 4);

    if (regs.fNZ) {
      m.step(0x063c, 12); // jr nz,0x063c (taken)
      continue;
    }
    m.step(0x064a, 7);
    break;
  }

  m.ret();
}
