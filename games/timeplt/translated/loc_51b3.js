// SPDX-License-Identifier: GPL-3.0-only

// loc_51b3  (ROM 0x51B3–0x51DD)
export function loc_51b3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa800);
  m.step(0x51b6, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x51b7, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // 0x51b7 ret nz -- taken
    return;
  }
  m.step(0x51b8, 5); // ret nz not taken

  do {
    regs.a = mem.read8(regs.de);
    m.step(0x51b9, 7); // ld a,(de)
    regs.a = regs.inc8(regs.a);
    m.step(0x51ba, 4); // inc a

    let skip = false;
    if (regs.fNZ) {
      m.step(0x51d3, 12); // jr nz,0x51d3 taken
      skip = true;
    } else {
      m.step(0x51bc, 7); // jr nz not taken
      regs.a = mem.read8(0xaa10);
      m.step(0x51bf, 13); // ld a,(0xaa10)
      regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
      m.step(0x51c2, 19); // sub (iy+0x00)
      regs.add(regs.l);
      m.step(0x51c3, 4); // add a,l
      regs.cp(regs.h);
      m.step(0x51c4, 4); // cp h
      if (regs.fNC) {
        m.step(0x51d3, 12); // jr nc,0x51d3 taken
        skip = true;
      } else {
        m.step(0x51c6, 7); // jr nc not taken
        regs.a = mem.read8(0xaa41);
        m.step(0x51c9, 13); // ld a,(0xaa41)
        regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
        m.step(0x51cc, 19); // sub (iy+0x31)
        regs.add(regs.l);
        m.step(0x51cd, 4); // add a,l
        regs.cp(regs.h);
        m.step(0x51ce, 4); // cp h
        if (regs.fNC) {
          m.step(0x51d3, 12); // jr nc,0x51d3 taken
          skip = true;
        } else {
          m.step(0x51d0, 7); // jr nc not taken
        }
      }
    }

    if (!skip) {
      regs.a = 0xf0;
      m.step(0x51d2, 7); // ld a,0xf0
      mem.write8(regs.de, regs.a);
      m.step(0x51d3, 7); // ld (de),a
    }

    regs.a = regs.e;
    m.step(0x51d4, 4); // ld a,e
    regs.add(0x10);
    m.step(0x51d6, 7); // add a,0x10
    regs.e = regs.a;
    m.step(0x51d7, 4); // ld e,a
    regs.iy = (regs.iy + 1) & 0xffff; // inc iy -- 16-bit, no flags
    m.step(0x51d9, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x51db, 10); // inc iy
    regs.djnz();
    m.step(regs.b !== 0 ? 0x51b8 : 0x51dd, regs.b !== 0 ? 13 : 8); // djnz 0x51b8
  } while (regs.b !== 0);

  m.ret(); // 0x51dd
}
