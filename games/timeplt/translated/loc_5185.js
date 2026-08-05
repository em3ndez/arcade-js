// SPDX-License-Identifier: GPL-3.0-only

// loc_5185  (ROM 0x5185–0x51B2)
export function loc_5185(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa800);
  m.step(0x5188, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x5189, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // 0x5189 ret nz -- taken
    return;
  }
  m.step(0x518a, 5); // ret nz not taken

  do {
    regs.a = mem.read8(regs.de);
    m.step(0x518b, 7); // ld a,(de)
    regs.a = regs.inc8(regs.a);
    m.step(0x518c, 4); // inc a

    let skip = false;
    if (regs.fNZ) {
      m.step(0x51a8, 12); // jr nz,0x51a8 taken
      skip = true;
    } else {
      m.step(0x518e, 7); // jr nz not taken
      regs.a = mem.read8(0xaa10);
      m.step(0x5191, 13); // ld a,(0xaa10)
      regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
      m.step(0x5194, 19); // sub (iy+0x00)
      regs.add(regs.l);
      m.step(0x5195, 4); // add a,l
      regs.cp(regs.h);
      m.step(0x5196, 4); // cp h
      if (regs.fNC) {
        m.step(0x51a8, 12); // jr nc,0x51a8 taken
        skip = true;
      } else {
        m.step(0x5198, 7); // jr nc not taken
        regs.a = mem.read8(0xaa41);
        m.step(0x519b, 13); // ld a,(0xaa41)
        regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
        m.step(0x519e, 19); // sub (iy+0x31)
        regs.add(regs.l);
        m.step(0x519f, 4); // add a,l
        regs.cp(regs.h);
        m.step(0x51a0, 4); // cp h
        if (regs.fNC) {
          m.step(0x51a8, 12); // jr nc,0x51a8 taken
          skip = true;
        } else {
          m.step(0x51a2, 7); // jr nc not taken
        }
      }
    }

    if (!skip) {
      regs.a = 0xf0;
      m.step(0x51a4, 7); // ld a,0xf0
      mem.write8(0xa800, regs.a);
      m.step(0x51a7, 13); // ld (0xa800),a
      mem.write8(regs.de, regs.a);
      m.step(0x51a8, 7); // ld (de),a
    }

    regs.a = regs.e;
    m.step(0x51a9, 4); // ld a,e
    regs.add(0x10);
    m.step(0x51ab, 7); // add a,0x10
    regs.e = regs.a;
    m.step(0x51ac, 4); // ld e,a
    regs.iy = (regs.iy + 1) & 0xffff; // inc iy -- 16-bit, no flags
    m.step(0x51ae, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x51b0, 10); // inc iy
    regs.djnz();
    m.step(regs.b !== 0 ? 0x518a : 0x51b2, regs.b !== 0 ? 13 : 8); // djnz 0x518a
  } while (regs.b !== 0);

  m.ret(); // 0x51b2
}
