// SPDX-License-Identifier: GPL-3.0-only

// loc_1dd3  (ROM 0x1dd3-0x1e2b) -- idx1 field/row painter selector. Chooses one of three blit jobs
// keyed on 0x8904 (in-progress flag), 0x8806 (credit/active) and 0x8907 (bit0 = variant):
//   B (loc_1deb): default -- source at BC (0x0839 or 0x0879 per 0x8907 bit0), then paint 4 rows of
//     tile 0x0f down two columns (0x8045, 0x8046; stride 0x20).
//   C (loc_1e11): the 0x8907-bit0-set / cleared-and-zero case -- when 0x8f50 (attract) is set it
//     falls back to B; otherwise source 0x0859, then paint 16 rows of tile 0x09 at 0x811c.
// HL is set to 0x8907 up front and every entry into B relies on it (the `ld a,(hl)` at 0x1deb).
// loc_075d preserves nothing needed afterward (HL/DE/A reloaded), so its clobbers are irrelevant.
export function loc_1dd3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8904);        m.step(0x1dd6, 13);
  regs.and(regs.a);                  m.step(0x1dd7, 4);
  regs.hl = 0x8907;                  m.step(0x1dda, 10);
  let goC = false;
  if (regs.fNZ) {
    m.step(0x1deb, 12);              // jr nz,0x1deb -> B (in progress)
  } else {
    m.step(0x1ddc, 7);
    regs.a = mem.read8(0x8806);      m.step(0x1ddf, 13);
    regs.and(regs.a);                m.step(0x1de0, 4);
    if (regs.fZ) {
      m.step(0x1deb, 12);            // jr z,0x1deb -> B (no credit)
    } else {
      m.step(0x1de2, 7);
      regs.a = mem.read8(regs.hl);   m.step(0x1de3, 7); // (0x8907)
      regs.bit(0, regs.a);           m.step(0x1de5, 8);
      if (regs.fNZ) { m.step(0x1e11, 12); goC = true; } // jr nz,0x1e11 -> C
      else {
        m.step(0x1de7, 7);
        regs.a = mem.read8(regs.hl); m.step(0x1de8, 7);
        regs.and(regs.a);            m.step(0x1de9, 4);
        if (regs.fZ) { m.step(0x1e11, 12); goC = true; } // jr z,0x1e11 -> C
        else { m.step(0x1deb, 7); }  // fall through -> B
      }
    }
  }

  // loc_1e11 (C): may fall back to B when attract (0x8f50) is set.
  if (goC) {
    regs.a = mem.read8(0x8f50);      m.step(0x1e14, 13);
    regs.and(regs.a);                m.step(0x1e15, 4);
    if (regs.fNZ) {
      m.step(0x1deb, 12);            // jr nz,0x1deb -> B (attract); fall through to B below
    } else {
      m.step(0x1e17, 7);
      regs.bc = 0x0859;              m.step(0x1e1a, 10);
      m.push16(0x1e1d);
      m.step(0x075d, 17);            // 1e1a  call 0x075d
      m.call(0x075d);
      regs.hl = 0x811c;              m.step(0x1e20, 10);
      regs.de = 0x0020;              m.step(0x1e23, 10);
      regs.b = 0x10;                 m.step(0x1e25, 7);
      regs.a = 0x09;                 m.step(0x1e27, 7);
      for (;;) { // paint 16 rows of tile 0x09 at 0x811c (stride 0x20)
        mem.write8(regs.hl, regs.a); m.step(0x1e28, 7);
        regs.addHl(regs.de);         m.step(0x1e29, 11);
        if (regs.djnz()) { m.step(0x1e27, 13); } else { m.step(0x1e2b, 8); break; }
      }
      return m.ret(); // 1e2b  ret
    }
  }

  // loc_1deb (B)
  regs.a = mem.read8(regs.hl);       m.step(0x1dec, 7); // (0x8907)
  regs.and(0x01);                    m.step(0x1dee, 7);
  regs.bc = 0x0839;                  m.step(0x1df1, 10);
  if (regs.fNZ) {
    m.step(0x1df6, 12);              // jr nz,0x1df6
  } else {
    m.step(0x1df3, 7);
    regs.bc = 0x0879;                m.step(0x1df6, 10);
  }
  m.push16(0x1df9);
  m.step(0x075d, 17);                // 1df6  call 0x075d
  m.call(0x075d);
  regs.a = 0x0f;                     m.step(0x1dfb, 7);
  regs.hl = 0x8045;                  m.step(0x1dfe, 10);
  regs.de = 0x0020;                  m.step(0x1e01, 10);
  regs.b = 0x04;                     m.step(0x1e03, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);     m.step(0x1e04, 7);
    regs.addHl(regs.de);             m.step(0x1e05, 11);
    if (regs.djnz()) { m.step(0x1e03, 13); } else { m.step(0x1e07, 8); break; }
  }
  regs.hl = 0x8046;                  m.step(0x1e0a, 10);
  regs.b = 0x04;                     m.step(0x1e0c, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);     m.step(0x1e0d, 7);
    regs.addHl(regs.de);             m.step(0x1e0e, 11);
    if (regs.djnz()) { m.step(0x1e0c, 13); } else { m.step(0x1e10, 8); break; }
  }
  m.ret(); // 1e10  ret
}
