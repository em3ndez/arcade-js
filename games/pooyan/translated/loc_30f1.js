// SPDX-License-Identifier: GPL-3.0-only
//
// loc_30f1  (ROM 0x30f1-0x316d) -- hunter-formation dispatch state 0 (rst 0x30eb[0]): launch. Seeds
// the 4 registered hunters (IY = each 0x8920 slot pointer) with anim/coord/tile bytes from table
// 0x3337 and a 0x30 frame delay (iy+0x09); primes the 0x8928 wave timer and (0x8f08); clears three
// 3-tile video columns at 0x84c2 (rst 0x10); seats the script pointer (0x8f4b)=0x3370; runs loc_0f19
// and the return-scan loc_323e. It then runs a ROM tamper check (0x68ac vs the 0x3278 code); a
// mismatch wipes work RAM 0x8800+ (ldir). rst 0x10 = loc_0010; tables 0x3337/0x3370 are ROM data.
export function loc_30f1(m) {
  const { regs, mem } = m;

  regs.ix = 0x8920; m.step(0x30f5, 14);
  regs.hl = 0x3337; m.step(0x30f8, 10);
  regs.b = 0x04; m.step(0x30fa, 7);
  for (;;) {
    regs.e = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x30fd, 19); // 30fa  ld e,(ix+0)
    regs.d = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x3100, 19); // 30fd  ld d,(ix+1)
    regs.iy = (regs.iy & 0xff00) | regs.e; m.step(0x3102, 8);
    regs.iy = (regs.iy & 0x00ff) | (regs.d << 8); m.step(0x3104, 8);
    regs.a = mem.read8(regs.hl); m.step(0x3105, 7); // 3104  ld a,(hl)
    mem.write8((regs.iy + 0x04) & 0xffff, regs.a); m.step(0x3108, 19); // 3105  ld (iy+0x04),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3109, 6);
    regs.a = mem.read8(regs.hl); m.step(0x310a, 7); // 3109  ld a,(hl)
    mem.write8((regs.iy + 0x06) & 0xffff, regs.a); m.step(0x310d, 19); // 310a  ld (iy+0x06),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x310e, 6);
    regs.a = mem.read8(regs.hl); m.step(0x310f, 7); // 310e  ld a,(hl)
    mem.write8((regs.iy + 0x0f) & 0xffff, regs.a); m.step(0x3112, 19); // 310f  ld (iy+0x0f),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3113, 6);
    regs.a = mem.read8(regs.hl); m.step(0x3114, 7); // 3113  ld a,(hl)
    mem.write8((regs.iy + 0x10) & 0xffff, regs.a); m.step(0x3117, 19); // 3114  ld (iy+0x10),a
    mem.write8((regs.iy + 0x09) & 0xffff, 0x30); m.step(0x311b, 19); // 3117  ld (iy+0x09),0x30
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x311d, 10);
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x311f, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3120, 6);
    if (regs.djnz() !== 0) { m.step(0x30fa, 13); continue; }
    m.step(0x3122, 8); break;
  }
  regs.a = 0x0c; m.step(0x3124, 7);
  mem.write8(0x8928, regs.a); m.step(0x3127, 13); // 3124  ld (0x8928),a
  regs.hl = 0x8f08; m.step(0x312a, 10);
  regs.incMem8(mem, regs.hl); m.step(0x312b, 11); // 312a  inc (hl)
  regs.a = 0x10; m.step(0x312d, 7);
  regs.de = 0x001d; m.step(0x3130, 10);
  regs.hl = 0x84c2; m.step(0x3133, 10);
  regs.c = 0x03; m.step(0x3135, 7);
  for (;;) {
    regs.b = 0x03; m.step(0x3137, 7);
    m.push16(0x3138); m.step(0x0010, 11); m.call(0x0010); // 3137  rst 0x10 (fill 3 = 0x10)
    regs.addHl(regs.de); m.step(0x3139, 11);
    regs.c = regs.dec8(regs.c); m.step(0x313a, 4);
    if (regs.fNZ) { m.step(0x3135, 12); continue; }
    m.step(0x313c, 7); break;
  }
  regs.hl = 0x3370; m.step(0x313f, 10);
  mem.write16(0x8f4b, regs.hl); m.step(0x3142, 16); // 313f  ld (0x8f4b),hl
  m.push16(0x3145); m.step(0x0f19, 17); m.call(0x0f19);
  m.push16(0x3148); m.step(0x323e, 17); m.call(0x323e);
  regs.de = 0x68ac; m.step(0x314b, 10);
  regs.hl = 0x3278; m.step(0x314e, 10);
  regs.b = 0x40; m.step(0x3150, 7);
  regs.a = regs.e; m.step(0x3151, 4);
  regs.cp(mem.read8(regs.hl)); m.step(0x3152, 7); // 3151  cp (hl)
  if (regs.fNZ) {
    m.step(0x3163, 12);
  } else {
    m.step(0x3154, 7);
    regs.a = regs.d; m.step(0x3155, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3156, 6);
    regs.cp(mem.read8(regs.hl)); m.step(0x3157, 7); // 3156  cp (hl)
    if (regs.fNZ) {
      m.step(0x3163, 12);
    } else {
      m.step(0x3159, 7);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x315a, 6);
      let mismatch = false;
      for (;;) {
        regs.a = mem.read8(regs.de); m.step(0x315b, 7); // 315a  ld a,(de)
        regs.cp(mem.read8(regs.hl)); m.step(0x315c, 7); // 315b  cp (hl)
        if (regs.fNZ) { m.step(0x3163, 12); mismatch = true; break; }
        m.step(0x315e, 7);
        regs.de = (regs.de + 1) & 0xffff; m.step(0x315f, 6);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3160, 6);
        if (regs.djnz() !== 0) { m.step(0x315a, 13); continue; }
        m.step(0x3162, 8); break;
      }
      if (!mismatch) { m.ret(); return; } // 3162  ret (ROM verified)
    }
  }
  regs.xor(regs.a); m.step(0x3164, 4);
  regs.hl = 0x8800; m.step(0x3167, 10);
  regs.de = 0x8801; m.step(0x316a, 10);
  mem.write8(regs.hl, regs.a); m.step(0x316b, 7); // 316a  ld (hl),a
  m.ldirAt(0x316b, 0x316d); // 316b  ldir (tamper response: wipe work RAM)
  m.ret();
}
