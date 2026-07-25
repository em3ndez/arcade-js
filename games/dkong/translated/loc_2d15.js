// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d15  (ROM 0x2D15–0x2D4E) — frame-gated string/sprite renderer (the 2c-cluster convergence).
 * ROM 0x2D15-0x2DDA (198 bytes). Reached by fall-through from entry_2cf6.
 *
 * Frame gate on (0x62AF); a (0x638F) sub-counter selects an animation table (c*40 + 0x3932)
 * via call 0x004E; then a per-frame CHAR loop (loc_2d54) walks a 0x39xx string through
 * pointer (0x62A8), writing 4-byte records at (0x62AC)=DE with fields from IX=(0x62AA).
 * A 0x7F terminator -> loc_2d8c reinitialises the object record (IX+0..+14) + rst 0x38.
 * Three exits: ret nz frame gate, ret 0x2D82 (per-char), ret 0x2DDA (reinit). `ld ix,(nn)`
 * (0x2D55) is 20T (precedented at state0.js:8990, verified vs MAME).
 */
export function loc_2d15(m) {
  const { regs, mem } = m;

  regs.hl = 0x62af;
  m.step(0x2d18, 10); // ld hl,0x62af
  regs.decMem8(mem, regs.hl);
  m.step(0x2d19, 11); // dec (hl) -- (0x62af)--
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- frame gate
  m.step(0x2d1a, 5);
  mem.write8(regs.hl, 0x18);
  m.step(0x2d1c, 10); // ld (hl),0x18 -- reload
  regs.a = mem.read8(0x638f);
  m.step(0x2d1f, 13); // ld a,(0x638f)
  regs.and(regs.a);
  m.step(0x2d20, 4); // and a
  if (regs.fZ) { m.step(0x2d51, 10); return m.call(0x2d51); } // jp z,0x2d51
  m.step(0x2d23, 10);
  regs.c = regs.a;
  m.step(0x2d24, 4); // ld c,a
  regs.hl = 0x3932;
  m.step(0x2d27, 10); // ld hl,0x3932
  regs.a = mem.read8(0x6382);
  m.step(0x2d2a, 13); // ld a,(0x6382)
  regs.rrca();
  m.step(0x2d2b, 4); // rrca -- C = bit0(0x6382)
  if (regs.fC) {
    m.step(0x2d2f, 10); // jp c,0x2d2f (skip dec c)
  } else {
    m.step(0x2d2e, 10);
    regs.c = regs.dec8(regs.c);
    m.step(0x2d2f, 4); // dec c
  }
  // -- loc_2d2f: C * 40 -> DE --
  regs.a = regs.c;
  m.step(0x2d30, 4); // ld a,c
  regs.add(regs.a);
  m.step(0x2d31, 4); // add a,a (*2)
  regs.add(regs.a);
  m.step(0x2d32, 4); // add a,a (*4)
  regs.add(regs.a);
  m.step(0x2d33, 4); // add a,a (*8)
  regs.c = regs.a;
  m.step(0x2d34, 4); // ld c,a (C = c*8)
  regs.add(regs.a);
  m.step(0x2d35, 4); // add a,a (*16)
  regs.add(regs.a);
  m.step(0x2d36, 4); // add a,a (*32)
  regs.add(regs.c);
  m.step(0x2d37, 4); // add a,c (A = c*40)
  regs.e = regs.a;
  m.step(0x2d38, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x2d3a, 7); // ld d,0x00 (DE = c*40)
  regs.addHl(regs.de);
  m.step(0x2d3b, 11); // add hl,de (HL = 0x3932 + c*40)
  m.push16(0x2d3e); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.hl = 0x638f;
  m.step(0x2d41, 10); // ld hl,0x638f
  regs.decMem8(mem, regs.hl);
  m.step(0x2d42, 11); // dec (hl) -- (0x638f)--
  if (regs.fNZ) { m.step(0x2d51, 10); return m.call(0x2d51); } // jp nz,0x2d51
  m.step(0x2d45, 10);
  regs.a = 0x01;
  m.step(0x2d47, 7); // ld a,0x01
  mem.write8(0x62af, regs.a);
  m.step(0x2d4a, 13); // ld (0x62af),a
  regs.a = mem.read8(0x6382);
  m.step(0x2d4d, 13); // ld a,(0x6382)
  regs.rrca();
  m.step(0x2d4e, 4); // rrca
  if (regs.fC) { m.step(0x2d83, 10); return m.call(0x2d83); } // jp c,0x2d83
  m.step(0x2d51, 10); // jp c NOT taken -> fall into loc_2d51
  return m.call(0x2d51);
}
