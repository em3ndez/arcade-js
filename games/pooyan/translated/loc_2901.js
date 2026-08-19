// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2901  (ROM 0x2901-0x295b) -- 0x8a80 actor state 0 (dispatch 0x28f1[0]). Drives base Y
// (ix+0x04) downward; while below 0xdc it refreshes the derived sprite Ys (loc_23d7), advances the
// script (loc_2405) unless (0x88be)==0xf9, and tail-jumps to the phase tail loc_23a1. At/after 0xdc
// it loads a shape (loc_250f), reseeds counters, and runs two ROM self-checks over 0x0859: sum!=0x63
// re-enters loc_2ae8, and a byte-compare mismatch vs table 0x2980 re-enters loc_2b9a; on success it
// runs loc_0fa2. All fail-arms target real code (delegated). loc_23d7/2405/250f/0fa2 pattern A.
export function loc_2901(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x11) & 0xffff, 0x01); m.step(0x2905, 19); // 2901  ld (ix+0x11),0x01
  regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x2908, 23); // 2905  inc (ix+0x04)
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x290b, 19); // 2908  ld a,(ix+0x04)
  regs.cp(0xdc); m.step(0x290d, 7);
  if (regs.fNC) {
    m.step(0x291e, 12);
  } else {
    m.step(0x290f, 7);
    m.push16(0x2912); m.step(0x23d7, 17); m.call(0x23d7);
    regs.a = mem.read8(0x88be); m.step(0x2915, 13); // 2912  ld a,(0x88be)
    regs.cp(0xf9); m.step(0x2917, 7);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x2918, 5);
    m.push16(0x291b); m.step(0x2405, 17); m.call(0x2405);
    m.step(0x23a1, 10); return m.call(0x23a1);
  }
  regs.hl = 0x2d59; m.step(0x2921, 10);
  m.push16(0x2924); m.step(0x250f, 17); m.call(0x250f);
  regs.hl = 0x8a91; m.step(0x2927, 10);
  mem.write8(regs.hl, 0x0c); m.step(0x2929, 10); // 2927  ld (hl),0x0c
  regs.l = 0x82; m.step(0x292b, 7); // 2929  ld l,0x82 -> 0x8a82
  regs.incMem8(mem, regs.hl); m.step(0x292c, 11); // 292b  inc (hl)
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x292d, 6);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x292e, 6); // 292d  inc hl -> 0x8a84
  regs.a = mem.read8(regs.hl); m.step(0x292f, 7); // 292e  ld a,(hl)
  regs.sub(0x03); m.step(0x2931, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2932, 7); // 2931  ld (hl),a
  regs.xor(regs.a); m.step(0x2933, 4);
  mem.write8(0x8a9c, regs.a); m.step(0x2936, 13); // 2933  ld (0x8a9c),a
  mem.write8(0x8a9e, regs.a); m.step(0x2939, 13); // 2936  ld (0x8a9e),a
  regs.hl = 0x0859; m.step(0x293c, 10);
  regs.bc = 0x2000; m.step(0x293f, 10);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x2940, 7); // 293f  ld a,(hl)
    regs.add(regs.c); m.step(0x2941, 4);
    regs.c = regs.a; m.step(0x2942, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2943, 6);
    if (regs.djnz() !== 0) { m.step(0x293f, 13); continue; }
    m.step(0x2945, 8); break;
  }
  regs.cp(0x63); m.step(0x2947, 7);
  if (regs.fNZ) { m.step(0x2ae8, 10); return m.call(0x2ae8); } // 2947  jp nz,0x2ae8 (guard)
  m.step(0x294a, 10);
  regs.b = 0x20; m.step(0x294c, 7);
  regs.de = 0x2980; m.step(0x294f, 10);
  for (;;) {
    regs.de = (regs.de - 1) & 0xffff; m.step(0x2950, 6);
    regs.a = mem.read8(regs.de); m.step(0x2951, 7); // 2950  ld a,(de)
    regs.cp(mem.read8(regs.hl)); m.step(0x2952, 7); // 2951  cp (hl)
    if (regs.fNZ) { m.step(0x2b9a, 10); return m.call(0x2b9a); } // 2952  jp nz,0x2b9a (guard)
    m.step(0x2955, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2956, 6);
    if (regs.djnz() !== 0) { m.step(0x294f, 13); continue; }
    m.step(0x2958, 8); break;
  }
  m.push16(0x295b); m.step(0x0fa2, 17); m.call(0x0fa2);
  m.ret();
}
