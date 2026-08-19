// SPDX-License-Identifier: GPL-3.0-only
//
// loc_316e  (ROM 0x316e-0x323d) -- hunter-formation dispatch state 1 (rst 0x30eb[1]): the swoop. Runs
// the 0x8928 wave timer, then advances the lead hunter (IY = the 0x8920[0] pointer): a script byte
// from (0x8f4b) either steps its sub-pixel X (iy+0x05/0x06) or its dwell (iy+0x09/0x04), and its X
// (iy+0x03) is driven by (iy+0x04). When it crosses the player X (0x8a84) it arms the dive
// ((0x8f24)/(0x8f4a), script 0x3348, loc_0f1d); past tile 0x1b it re-primes the wave timer. Finally
// it stamps three display records (0x8920[1..3] pointers +3) from the lead's state, then falls into
// the return-scan loc_323e. loc_0f1d pattern A; scripts 0x3348 are ROM data.
export function loc_316e(m) {
  const { regs, mem } = m;

  regs.hl = 0x8928; m.step(0x3171, 10);
  regs.a = mem.read8(regs.hl); m.step(0x3172, 7); // 3171  ld a,(hl)
  regs.and(regs.a); m.step(0x3173, 4);
  if (regs.fZ) {
    m.step(0x3177, 12);
  } else {
    m.step(0x3175, 7);
    regs.decMem8(mem, regs.hl); m.step(0x3176, 11); // 3175  dec (hl)
    m.ret(); return;
  }
  regs.l = 0x20; m.step(0x3179, 7); // 3177  ld l,0x20 -> 0x8920
  regs.e = mem.read8(regs.hl); m.step(0x317a, 7); // 3179  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x317b, 6);
  regs.d = mem.read8(regs.hl); m.step(0x317c, 7); // 317b  ld d,(hl)
  m.push16(regs.de); m.step(0x317d, 11);
  regs.iy = m.pop16(); m.step(0x317f, 14); // 317d  pop iy (lead hunter record)
  regs.hl = mem.read16(0x8f4b); m.step(0x3182, 16); // 317f  ld hl,(0x8f4b)
  regs.a = mem.read8(regs.hl); m.step(0x3183, 7); // 3182  ld a,(hl)
  regs.and(regs.a); m.step(0x3184, 4);
  if (regs.fZ) {
    m.step(0x3199, 12);
    regs.incMem8(mem, (regs.iy + 0x09) & 0xffff); m.step(0x319c, 23); // 3199  inc (iy+0x09)
    if (regs.fNZ) {
      m.step(0x31a1, 12);
    } else {
      m.step(0x319e, 7);
      regs.incMem8(mem, (regs.iy + 0x04) & 0xffff); m.step(0x31a1, 23); // 319e  inc (iy+0x04)
    }
    regs.a = mem.read8((regs.iy + 0x09) & 0xffff); m.step(0x31a4, 19); // 31a1  ld a,(iy+0x09)
  } else {
    m.step(0x3186, 7);
    regs.add(mem.read8((regs.iy + 0x05) & 0xffff)); m.step(0x3189, 19); // 3186  add a,(iy+0x05)
    if (regs.fNC) {
      m.step(0x318e, 12);
    } else {
      m.step(0x318b, 7);
      regs.incMem8(mem, (regs.iy + 0x06) & 0xffff); m.step(0x318e, 23); // 318b  inc (iy+0x06)
    }
    mem.write8((regs.iy + 0x05) & 0xffff, regs.a); m.step(0x3191, 19); // 318e  ld (iy+0x05),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3192, 6);
    regs.a = mem.read8(regs.hl); m.step(0x3193, 7); // 3192  ld a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3194, 6);
    mem.write16(0x8f4b, regs.hl); m.step(0x3197, 16); // 3194  ld (0x8f4b),hl
    m.step(0x31a4, 12);
  }
  regs.add(mem.read8((regs.iy + 0x03) & 0xffff)); m.step(0x31a7, 19); // 31a4  add a,(iy+0x03)
  if (regs.fNC) {
    m.step(0x31ac, 12);
  } else {
    m.step(0x31a9, 7);
    regs.incMem8(mem, (regs.iy + 0x04) & 0xffff); m.step(0x31ac, 23); // 31a9  inc (iy+0x04)
  }
  mem.write8((regs.iy + 0x03) & 0xffff, regs.a); m.step(0x31af, 19); // 31ac  ld (iy+0x03),a
  regs.a = mem.read8(0x8f4a); m.step(0x31b2, 13); // 31af  ld a,(0x8f4a)
  regs.and(regs.a); m.step(0x31b3, 4);
  regs.a = mem.read8((regs.iy + 0x04) & 0xffff); m.step(0x31b6, 19); // 31b3  ld a,(iy+0x04) (flags kept)
  if (regs.fNZ) {
    m.step(0x31d7, 12);
    regs.cp(0x1b); m.step(0x31d9, 7);
    if (regs.fC) {
      m.step(0x31e5, 12);
    } else {
      m.step(0x31db, 7);
      mem.write8(0x8928, regs.a); m.step(0x31de, 13); // 31db  ld (0x8928),a
      regs.hl = 0x8f08; m.step(0x31e1, 10);
      regs.incMem8(mem, regs.hl); m.step(0x31e2, 11); // 31e1  inc (hl)
      m.push16(0x31e5); m.step(0x0f1d, 17); m.call(0x0f1d);
    }
  } else {
    m.step(0x31b8, 7);
    regs.rlca(); m.step(0x31b9, 4);
    regs.rlca(); m.step(0x31ba, 4);
    regs.rlca(); m.step(0x31bb, 4);
    regs.add(0x18); m.step(0x31bd, 7);
    regs.c = regs.a; m.step(0x31be, 4);
    regs.a = mem.read8(0x8a84); m.step(0x31c1, 13); // 31be  ld a,(0x8a84)
    regs.cp(regs.c); m.step(0x31c2, 4);
    if (regs.fNC) {
      m.step(0x31e5, 12);
    } else {
      m.step(0x31c4, 7);
      regs.a = 0x01; m.step(0x31c6, 7);
      mem.write8(0x8f24, regs.a); m.step(0x31c9, 13); // 31c6  ld (0x8f24),a
      mem.write8(0x8f4a, regs.a); m.step(0x31cc, 13); // 31c9  ld (0x8f4a),a
      regs.hl = 0x3348; m.step(0x31cf, 10);
      mem.write16(0x8f4b, regs.hl); m.step(0x31d2, 16); // 31cf  ld (0x8f4b),hl
      m.push16(0x31d5); m.step(0x0f1d, 17); m.call(0x0f1d);
      m.step(0x31e5, 12);
    }
  }
  regs.c = mem.read8((regs.iy + 0x04) & 0xffff); m.step(0x31e8, 19); // 31e5  ld c,(iy+0x04)
  regs.b = mem.read8((regs.iy + 0x06) & 0xffff); m.step(0x31eb, 19); // 31e8  ld b,(iy+0x06)
  regs.ix = 0x8920; m.step(0x31ef, 14);
  regs.de = 0x0003; m.step(0x31f2, 10);
  regs.l = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x31f5, 19); // 31f2  ld l,(ix+0x02)
  regs.h = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x31f8, 19); // 31f5  ld h,(ix+0x03)
  regs.addHl(regs.de); m.step(0x31f9, 11);
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff); m.step(0x31fc, 19); // 31f9  ld a,(iy+0x03)
  mem.write8(regs.hl, regs.a); m.step(0x31fd, 7); // 31fc  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x31fe, 6);
  regs.a = regs.c; m.step(0x31ff, 4);
  mem.write8(regs.hl, regs.a); m.step(0x3200, 7); // 31ff  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3201, 6);
  regs.a = mem.read8((regs.iy + 0x05) & 0xffff); m.step(0x3204, 19); // 3201  ld a,(iy+0x05)
  mem.write8(regs.hl, regs.a); m.step(0x3205, 7); // 3204  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3206, 6);
  regs.a = regs.b; m.step(0x3207, 4);
  regs.add(0x02); m.step(0x3209, 7);
  mem.write8(regs.hl, regs.a); m.step(0x320a, 7); // 3209  ld (hl),a
  regs.l = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x320d, 19); // 320a  ld l,(ix+0x04)
  regs.h = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3210, 19); // 320d  ld h,(ix+0x05)
  regs.addHl(regs.de); m.step(0x3211, 11);
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff); m.step(0x3214, 19); // 3211  ld a,(iy+0x03)
  mem.write8(regs.hl, regs.a); m.step(0x3215, 7); // 3214  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3216, 6);
  regs.a = regs.c; m.step(0x3217, 4);
  regs.add(0x02); m.step(0x3219, 7);
  mem.write8(regs.hl, regs.a); m.step(0x321a, 7); // 3219  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x321b, 6);
  regs.a = mem.read8((regs.iy + 0x05) & 0xffff); m.step(0x321e, 19); // 321b  ld a,(iy+0x05)
  mem.write8(regs.hl, regs.a); m.step(0x321f, 7); // 321e  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3220, 6);
  regs.a = regs.b; m.step(0x3221, 4);
  mem.write8(regs.hl, regs.a); m.step(0x3222, 7); // 3221  ld (hl),a
  regs.l = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3225, 19); // 3222  ld l,(ix+0x06)
  regs.h = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3228, 19); // 3225  ld h,(ix+0x07)
  regs.addHl(regs.de); m.step(0x3229, 11);
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff); m.step(0x322c, 19); // 3229  ld a,(iy+0x03)
  mem.write8(regs.hl, regs.a); m.step(0x322d, 7); // 322c  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x322e, 6);
  regs.a = regs.c; m.step(0x322f, 4);
  regs.add(0x02); m.step(0x3231, 7);
  mem.write8(regs.hl, regs.a); m.step(0x3232, 7); // 3231  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3233, 6);
  regs.a = mem.read8((regs.iy + 0x05) & 0xffff); m.step(0x3236, 19); // 3233  ld a,(iy+0x05)
  mem.write8(regs.hl, regs.a); m.step(0x3237, 7); // 3236  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3238, 6);
  regs.a = regs.b; m.step(0x3239, 4);
  regs.add(0x02); m.step(0x323b, 7);
  mem.write8(regs.hl, regs.a); m.step(0x323c, 7); // 323b  ld (hl),a
  regs.b = 0x04; m.step(0x323e, 7);
  return m.call(0x323e); // fall into loc_323e
}
