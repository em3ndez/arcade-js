// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2a2f  (ROM 0x2A2F–0x2A84).
 */
export function sub_2a2f(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x03));
  m.step(0x2a32, 19); // ld a,(ix+0x03)
  regs.h = regs.a; // H = Y
  m.step(0x2a33, 4); // ld h,a
  regs.a = mem.read8(IX(0x05));
  m.step(0x2a36, 19); // ld a,(ix+0x05)
  regs.add(0x04); // +4
  m.step(0x2a38, 7); // add a,0x04
  regs.l = regs.a; // L = X + 4
  m.step(0x2a39, 4); // ld l,a

  m.push16(regs.hl); // push hl -- the position
  m.step(0x2a3a, 11);
  m.push16(0x2a3d);
  m.step(0x2ff0, 17);
  m.call(0x2ff0); // HL = pos -> HL = tilemap cell ptr
  regs.de = m.pop16(); // pop de -- DE = the saved position (E = X+4)
  m.step(0x2a3e, 10);

  regs.a = mem.read8(regs.hl); // the tile
  m.step(0x2a3f, 7); // ld a,(hl)
  regs.cp(0xb0);
  m.step(0x2a41, 7); // cp 0xb0
  if (regs.fC) return noCollision(); // jp c,0x2a7b -- passable
  m.step(0x2a44, 10);
  regs.and(0x0f);
  m.step(0x2a46, 7); // and 0x0f
  regs.cp(0x08);
  m.step(0x2a48, 7); // cp 0x08
  if (regs.fNC) return noCollision(); // jp nc,0x2a7b
  m.step(0x2a4b, 10);

  regs.a = mem.read8(regs.hl); // re-read the tile
  m.step(0x2a4c, 7); // ld a,(hl)
  regs.cp(0xc0);
  m.step(0x2a4e, 7); // cp 0xc0
  if (regs.fZ) return noCollision(); // jp z,0x2a7b -- exactly 0xC0
  const below_c0 = regs.fC;
  m.step(below_c0 ? 0x2a69 : 0x2a54, 10); // jp c,0x2a69

  let C;
  if (below_c0) {
    // -- loc_2a69: 0xB0-0xBF --
    regs.a = 0xff;
    m.step(0x2a6b, 7); // ld a,0xff
    m.step(0x2a72, 10); // jp 0x2a72
    C = regs.a;
  } else {
    regs.cp(0xd0);
    m.step(0x2a56, 7); // cp 0xd0
    if (regs.fC) {
      C = classSub9(0x2a6e); // jp c,0x2a6e -- 0xC1-0xCF
    } else {
      m.step(0x2a59, 10);
      regs.cp(0xe0);
      m.step(0x2a5b, 7); // cp 0xe0
      if (regs.fC) {
        C = classDec(0x2a63); // jp c,0x2a63 -- 0xD0-0xDF
      } else {
        m.step(0x2a5e, 10);
        regs.cp(0xf0);
        m.step(0x2a60, 7); // cp 0xf0
        if (regs.fC) C = classSub9(0x2a6e); // jp c,0x2a6e -- 0xE0-0xEF
        else C = classDec(0x2a63); // else (>= 0xF0)
      }
    }
  }

  // -- loc_2a72: X-adjust --
  regs.c = C;
  m.step(0x2a73, 4); // ld c,a
  regs.a = regs.e; // A = E (object X + 4)
  m.step(0x2a74, 4); // ld a,e
  regs.and(0xf8); // snap to tile boundary
  m.step(0x2a76, 7); // and 0xf8
  regs.add(regs.c); // + slope offset
  m.step(0x2a77, 4); // add a,c
  regs.cp(regs.e); // compare to original X
  m.step(0x2a78, 7); // cp e
  if (regs.fC) {
    // -- loc_2a7d: adjust --
    m.step(0x2a7d, 10); // jp c,0x2a7d
    regs.sub(0x04); // undo the +4
    m.step(0x2a7f, 7); // sub 0x04
    mem.write8(IX(0x05), regs.a); // (ix+0x05) = adjusted X
    m.step(0x2a82, 19);
    regs.a = 0x01;
    m.step(0x2a84, 7); // ld a,0x01
    m.ret();
    return;
  }
  return noCollision(); // jp c not taken -> fall to 0x2a7b

  function classDec(addr) {
    // loc_2a63: (tile & 0x0f) - 1
    m.step(addr, 10);
    regs.and(0x0f);
    m.step(0x2a65, 7); // and 0x0f
    regs.a = regs.dec8(regs.a);
    m.step(0x2a66, 4); // dec a
    m.step(0x2a72, 10); // jp 0x2a72
    return regs.a;
  }
  function classSub9(addr) {
    // loc_2a6e: (tile & 0x0f) - 9
    m.step(addr, 10);
    regs.and(0x0f);
    m.step(0x2a70, 7); // and 0x0f
    regs.sub(0x09);
    m.step(0x2a72, 4); // sub 0x09
    return regs.a;
  }
  function noCollision() {
    m.step(0x2a7b, 10); // jp to 0x2a7b
    regs.xor(regs.a); // A = 0
    m.step(0x2a7c, 4);
    m.ret();
  }
}
