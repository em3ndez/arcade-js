// SPDX-License-Identifier: GPL-3.0-only

// loc_744e  (ROM 0x744e-0x7499) -- dispatch state 0 (from loc_7442's table): seed attract-mode
// pointers/counters (0x88b7, 0x88ba/0x8f45, 0x88b8, 0x8f43), advance the selector (0x8921), then
// a ROM-signature check -- loop 1 compares ROM[0x0000..0x0007] to the reference copy at 0x749a,
// loop 2 compares ROM[0x0092..0x0105] (IX walked, ixl->ixh page carry) to the copy at 0x74a2. A
// loop-2 divergence aborts to 0x67df; a clean machine returns. The reference bytes at 0x749a-0x7516
// are DATA (verbatim copies of the boot code), read from ROM directly.
export function loc_744e(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x744f, 4); // 744e  xor a
  mem.write8(0x88b7, regs.a);
  m.step(0x7452, 13); // 744f  ld (0x88b7),a
  regs.de = 0x4af0;
  m.step(0x7455, 10); // 7452  ld de,0x4af0
  regs.hl = 0x43e1;
  m.step(0x7458, 10); // 7455  ld hl,0x43e1
  mem.write16(0x88ba, regs.hl);
  m.step(0x745b, 16); // 7458  ld (0x88ba),hl
  mem.write16(0x8f45, regs.de);
  m.step(0x745f, 20); // 745b  ld (0x8f45),de
  regs.hl = 0x8442;
  m.step(0x7462, 10); // 745f  ld hl,0x8442
  mem.write16(0x88b8, regs.hl);
  m.step(0x7465, 16); // 7462  ld (0x88b8),hl
  regs.hl = 0x8042;
  m.step(0x7468, 10); // 7465  ld hl,0x8042
  mem.write16(0x8f43, regs.hl);
  m.step(0x746b, 16); // 7468  ld (0x8f43),hl
  regs.hl = 0x8921;
  m.step(0x746e, 10); // 746b  ld hl,0x8921
  regs.incMem8(mem, regs.hl);
  m.step(0x746f, 11); // 746e  inc (hl) -- advance the state selector
  regs.hl = 0x749a;
  m.step(0x7472, 10); // 746f  ld hl,0x749a -- reference copy of ROM[0x0000..]
  regs.de = 0x0000;
  m.step(0x7475, 10); // 7472  ld de,0x0000
  regs.b = 0x08;
  m.step(0x7477, 7); // 7475  ld b,0x08

  // loop 1: compare ROM[0x0000..0x0007] to the reference at 0x749a.
  let jumpedToLoop2 = false;
  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x7478, 7); // 7477  ld a,(de)
    regs.cp(mem.read8(regs.hl));
    m.step(0x7479, 7); // 7478  cp (hl)
    if (regs.fNZ) { m.step(0x7486, 10); jumpedToLoop2 = true; break; } // 7479  jp nz,0x7486
    m.step(0x747c, 10); // 7479  jp nz (not taken)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x747d, 6); // 747c  inc hl
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x747e, 6); // 747d  inc de
    if (regs.djnz() !== 0) { m.step(0x7477, 13); continue; } // 747e  djnz 0x7477
    m.step(0x7480, 8); break; // 747e  djnz (fell through)
  }
  if (!jumpedToLoop2) {
    regs.ix = 0x0092;
    m.step(0x7484, 14); // 7480  ld ix,0x0092
    regs.b = 0x74;
    m.step(0x7486, 7); // 7484  ld b,0x74
  }

  // loop 2 (head 0x7486): compare ROM[0x0092..] to the reference at 0x74a2, IX walked with an
  // ixl->ixh page carry; any mismatch aborts to 0x67df.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x7489, 19); // 7486  ld a,(ix+0)
    regs.cp(mem.read8(regs.hl));
    m.step(0x748a, 7); // 7489  cp (hl)
    if (regs.fNZ) { m.step(0x67df, 10); return m.call(0x67df); } // 748a  jp nz,0x67df
    m.step(0x748d, 10); // 748a  jp nz (not taken)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x748e, 6); // 748d  inc hl
    regs.ix = (regs.ix & 0xff00) | regs.inc8(regs.ix & 0xff);
    m.step(0x7490, 8); // 748e  inc ixl
    regs.a = regs.ix & 0xff;
    m.step(0x7492, 8); // 7490  ld a,ixl
    regs.and(regs.a);
    m.step(0x7493, 4); // 7492  and a
    if (regs.fNZ) {
      m.step(0x7497, 12); // 7493  jr nz,0x7497 (no page carry)
    } else {
      m.step(0x7495, 7); // 7493  jr nz (not taken)
      regs.ix = (regs.ix & 0x00ff) | (regs.inc8((regs.ix >> 8) & 0xff) << 8);
      m.step(0x7497, 8); // 7495  inc ixh -- ixl wrapped, carry into ixh
    }
    if (regs.djnz() !== 0) { m.step(0x7486, 13); continue; } // 7497  djnz 0x7486
    m.step(0x7499, 8); break; // 7497  djnz (fell through)
  }
  m.ret(); // 7499  ret
}
