// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2333  (ROM 0x2333–0x236D) — coordinate clamp/step; H,L,B -> L.
 *
 *   2333  3e 0f        ld   a,0x0f
 *   2335  a4           and  h              ; A = H & 0x0F
 *   2336  05           dec  b
 *   2337  ca 42 23     jp   z,0x2342
 *   233a  fe 0f        cp   0x0f
 *   233c  d8           ret  c              ; (H&F) < 0x0F -> unchanged
 *   233d  06 ff        ld   b,0xff         ; step -1
 *   233f  c3 47 23     jp   0x2347
 *   2342  fe 01        cp   0x01           ; loc_2342
 *   2344  d0           ret  nc             ; (H&F) >= 1 -> unchanged
 *   2345  06 01        ld   b,0x01         ; step +1
 *   2347  3e f0        ld   a,0xf0         ; loc_2347
 *   2349  bd           cp   l
 *   234a  ca 60 23     jp   z,0x2360       ; L == 0xF0
 *   234d  3e 4c        ld   a,0x4c
 *   234f  bd           cp   l
 *   2350  ca 66 23     jp   z,0x2366       ; L == 0x4C
 *   2353  7d           ld   a,l
 *   2354  cb 6f        bit  5,a
 *   2356  ca 5c 23     jp   z,0x235c       ; bit5 clear -> add
 *   2359  90           sub  b              ; loc_2359: A = L - B   (bit5 set)
 *   235a  6f           ld   l,a            ; loc_235a
 *   235b  c9           ret
 *   235c  80           add  a,b            ; loc_235c: A = L + B   (bit5 clear)
 *   235d  c3 5a 23     jp   0x235a
 *   2360  cb 7c        bit  7,h            ; loc_2360 (L was 0xF0)
 *   2362  c2 59 23     jp   nz,0x2359      ; H bit7 set -> step
 *   2365  c9           ret                 ; H bit7 clear -> unchanged
 *   2366  7c           ld   a,h            ; loc_2366 (L was 0x4C)
 *   2367  fe 98        cp   0x98
 *   2369  d8           ret  c              ; H < 0x98 -> unchanged
 *   236a  7d           ld   a,l
 *   236b  c3 5c 23     jp   0x235c         ; H >= 0x98 -> add path
 */
export function entry_2333(m) {
  const { regs } = m;

  regs.a = 0x0f;
  m.step(0x2335, 7); // ld a,0x0f
  regs.and(regs.h);
  m.step(0x2336, 4); // and h -- A = H & 0x0F
  regs.b = regs.dec8(regs.b);
  m.step(0x2337, 4); // dec b
  if (regs.fZ) {
    m.step(0x2342, 10); // jp z,0x2342 -- loc_2342
    regs.cp(0x01);
    m.step(0x2344, 7); // cp 0x01
    if (regs.fNC) {
      m.ret(11); // ret nc -- (H&F) >= 1 -> L unchanged
      return;
    }
    m.step(0x2345, 5); // ret nc not taken
    regs.b = 0x01;
    m.step(0x2347, 7); // ld b,0x01 -- step +1, falls into loc_2347
  } else {
    m.step(0x233a, 10); // jp z not taken
    regs.cp(0x0f);
    m.step(0x233c, 7); // cp 0x0f
    if (regs.fC) {
      m.ret(11); // ret c -- (H&F) < 0x0F -> L unchanged
      return;
    }
    m.step(0x233d, 5); // ret c not taken
    regs.b = 0xff;
    m.step(0x233f, 7); // ld b,0xff -- step -1
    m.step(0x2347, 10); // jp 0x2347
  }

  // loc_2347: the L step, a small DAG converging on loc_235a (ld l,a / ret).
  let at = 0x2347;
  for (;;) {
    if (at === 0x2347) {
      regs.a = 0xf0;
      m.step(0x2349, 7); // ld a,0xf0
      regs.cp(regs.l);
      m.step(0x234a, 4); // cp l
      if (regs.fZ) { m.step(0x2360, 10); at = 0x2360; continue; } // L == 0xF0
      m.step(0x234d, 10); // jp z not taken
      regs.a = 0x4c;
      m.step(0x234f, 7); // ld a,0x4c
      regs.cp(regs.l);
      m.step(0x2350, 4); // cp l
      if (regs.fZ) { m.step(0x2366, 10); at = 0x2366; continue; } // L == 0x4C
      m.step(0x2353, 10); // jp z not taken
      regs.a = regs.l;
      m.step(0x2354, 4); // ld a,l
      regs.bit(5, regs.a);
      m.step(0x2356, 8); // bit 5,a -- register form, F3/F5 from operand (correct)
      if (regs.fZ) { m.step(0x235c, 10); at = 0x235c; continue; } // bit5 clear -> add
      m.step(0x2359, 10); // jp z not taken -> loc_2359 (bit5 set)
      at = 0x2359;
      continue;
    }
    if (at === 0x2360) {
      regs.bit(7, regs.h);
      m.step(0x2362, 8); // bit 7,h
      if (regs.fZ) { m.step(0x2365, 10); m.ret(10); return; } // jp nz not taken -> ret (unchanged)
      m.step(0x2359, 10); // jp nz taken -> loc_2359
      at = 0x2359;
      continue;
    }
    if (at === 0x2366) {
      regs.a = regs.h;
      m.step(0x2367, 4); // ld a,h
      regs.cp(0x98);
      m.step(0x2369, 7); // cp 0x98
      if (regs.fC) { m.ret(11); return; } // ret c -- H < 0x98 -> unchanged
      m.step(0x236a, 5); // ret c not taken
      regs.a = regs.l;
      m.step(0x236b, 4); // ld a,l
      m.step(0x235c, 10); // jp 0x235c
      at = 0x235c;
      continue;
    }
    if (at === 0x2359) {
      regs.sub(regs.b); // sub b -- A = L - B
      m.step(0x235a, 4);
      at = 0x235a;
      continue;
    }
    if (at === 0x235c) {
      regs.add(regs.b); // add a,b -- A = L + B
      m.step(0x235d, 4);
      m.step(0x235a, 10); // jp 0x235a
      at = 0x235a;
      continue;
    }
    // at === 0x235a
    regs.l = regs.a;
    m.step(0x235b, 4); // ld l,a
    m.ret(10); // ret (0x235B)
    return;
  }
}
