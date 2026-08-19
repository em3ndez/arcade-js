// SPDX-License-Identifier: GPL-3.0-only
//
// loc_278f  (ROM 0x278f-0x27f2) -- 0x8f30 state 0 (dispatch 0x277e[0]). Arms the launch flag
// (0x8f3f) once the 0x8d75/0x8901/0x8f20 preconditions hold, then gates on the arrow Y (0x8ab4)>=0x3c
// and two hunter-hit bits (0x8c90/0x8ca8 bit1); when clear it bumps (0x8f30), reseeds counters, may
// set a HUD tile (0x8508), copies (0x8d7a) into (0x8f20), and tail-blits a tile via loc_3325.
export function loc_278f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f3f); m.step(0x2792, 13); // 278f  ld a,(0x8f3f)
  regs.and(regs.a); m.step(0x2793, 4);
  if (regs.fNZ) {
    m.step(0x27b2, 12); // 2793  jr nz,0x27b2 (already armed)
  } else {
    m.step(0x2795, 7);
    regs.a = mem.read8(0x8d75); m.step(0x2798, 13); // 2795  ld a,(0x8d75)
    regs.and(regs.a); m.step(0x2799, 4);
    let go27a5 = false;
    if (regs.fZ) {
      m.step(0x27a5, 12); go27a5 = true;
    } else {
      m.step(0x279b, 7);
      regs.hl = 0x8f20; m.step(0x279e, 10);
      regs.a = mem.read8(regs.hl); m.step(0x279f, 7); // 279e  ld a,(hl)
      regs.and(regs.a); m.step(0x27a0, 4);
      if (regs.fNZ) {
        m.step(0x27a5, 12); go27a5 = true;
      } else {
        m.step(0x27a2, 7);
        regs.incMem8(mem, regs.hl); m.step(0x27a3, 11); // 27a2  inc (hl)
        m.step(0x27ad, 12);
      }
    }
    if (go27a5) {
      regs.a = mem.read8(0x8901); m.step(0x27a8, 13); // 27a5  ld a,(0x8901)
      regs.and(regs.a); m.step(0x27a9, 4);
      if (regs.fZ) { m.ret(11); return; }
      m.step(0x27aa, 5);
      regs.and(0x07); m.step(0x27ac, 7);
      if (regs.fNZ) { m.ret(11); return; }
      m.step(0x27ad, 5);
    }
    regs.a = 0x01; m.step(0x27af, 7);
    mem.write8(0x8f3f, regs.a); m.step(0x27b2, 13); // 27af  ld (0x8f3f),a
  }
  regs.a = mem.read8(0x8ab4); m.step(0x27b5, 13); // 27b2  ld a,(0x8ab4)
  regs.cp(0x3c); m.step(0x27b7, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x27b8, 5);
  regs.a = mem.read8(0x8c90); m.step(0x27bb, 13); // 27b8  ld a,(0x8c90)
  regs.bit(1, regs.a); m.step(0x27bd, 8);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x27be, 5);
  regs.a = mem.read8(0x8ca8); m.step(0x27c1, 13); // 27be  ld a,(0x8ca8)
  regs.bit(1, regs.a); m.step(0x27c3, 8);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x27c4, 5);
  regs.hl = 0x8f30; m.step(0x27c7, 10);
  regs.incMem8(mem, regs.hl); m.step(0x27c8, 11); // 27c7  inc (hl)
  regs.a = 0x08; m.step(0x27ca, 7);
  mem.write8(0x892f, regs.a); m.step(0x27cd, 13); // 27ca  ld (0x892f),a
  regs.a = mem.read8(0x8806); m.step(0x27d0, 13); // 27cd  ld a,(0x8806)
  regs.and(regs.a); m.step(0x27d1, 4);
  if (regs.fNZ) {
    m.step(0x27e1, 12);
  } else {
    m.step(0x27d3, 7);
    regs.a = mem.read8(0x8f50); m.step(0x27d6, 13); // 27d3  ld a,(0x8f50)
    regs.hl = 0x8f3f; m.step(0x27d9, 10);
    regs.or(mem.read8(regs.hl)); m.step(0x27da, 7); // 27d9  or (hl)
    if (regs.fZ) {
      m.step(0x27e1, 12);
    } else {
      m.step(0x27dc, 7);
      regs.a = 0x6f; m.step(0x27de, 7);
      mem.write8(0x8508, regs.a); m.step(0x27e1, 13); // 27de  ld (0x8508),a
    }
  }
  regs.a = mem.read8(0x8d7a); m.step(0x27e4, 13); // 27e1  ld a,(0x8d7a)
  regs.and(regs.a); m.step(0x27e5, 4);
  if (regs.fZ) {
    m.step(0x27ea, 12);
  } else {
    m.step(0x27e7, 7);
    mem.write8(0x8f20, regs.a); m.step(0x27ea, 13); // 27e7  ld (0x8f20),a
  }
  regs.hl = 0x84a7; m.step(0x27ed, 10);
  regs.de = 0x2d51; m.step(0x27f0, 10);
  m.step(0x3325, 10); return m.call(0x3325);
}
