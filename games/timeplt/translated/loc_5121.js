// SPDX-License-Identifier: GPL-3.0-only

// loc_5121  (ROM 0x5121–0x5151)
export function loc_5121(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa800);
  m.step(0x5124, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x5125, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- 0xA800 was not 0xFF
    return;
  }
  m.step(0x5126, 5); // ret nz (not taken)

  do {
    regs.a = mem.read8(regs.de);
    m.step(0x5127, 7); // ld a,(de)
    regs.a = regs.inc8(regs.a);
    m.step(0x5128, 4); // inc a

    if (regs.fNZ) {
      m.step(0x5147, 12); // jr nz,0x5147 (taken) -- entry not 0xFF
    } else {
      m.step(0x512a, 7); // jr nz,0x5147 (not taken)
      regs.a = mem.read8(0xaa10);
      m.step(0x512d, 13); // ld a,(0xaa10)
      regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
      m.step(0x5130, 19); // sub (iy+0x00)
      regs.add(regs.l); // bias by L
      m.step(0x5131, 4); // add a,l
      regs.cp(regs.h); // unsigned window compare
      m.step(0x5132, 4); // cp h
      if (regs.fNC) {
        m.step(0x5147, 12); // jr nc,0x5147 (taken) -- out of window
      } else {
        m.step(0x5134, 7); // jr nc,0x5147 (not taken)
        regs.a = mem.read8(0xaa41);
        m.step(0x5137, 13); // ld a,(0xaa41)
        regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
        m.step(0x513a, 19); // sub (iy+0x31)
        regs.add(regs.l);
        m.step(0x513b, 4); // add a,l
        regs.cp(regs.h);
        m.step(0x513c, 4); // cp h
        if (regs.fNC) {
          m.step(0x5147, 12); // jr nc,0x5147 (taken) -- out of window
        } else {
          m.step(0x513e, 7); // jr nc,0x5147 (not taken) -- A HIT
          regs.a = 0xf0;
          m.step(0x5140, 7); // ld a,0xf0
          mem.write8(0xa800, regs.a);
          m.step(0x5143, 13); // ld (0xa800),a
          mem.write8(regs.de, regs.a);
          m.step(0x5144, 7); // ld (de),a
          m.push16(0x5147);
          m.step(0x51de, 17); // call 0x51de
          m.call(0x51de);
        }
      }
    }

    regs.a = regs.e;
    m.step(0x5148, 4); // ld a,e
    regs.add(0x10);
    m.step(0x514a, 7); // add a,0x10
    regs.e = regs.a; // E only -- no carry into D
    m.step(0x514b, 4); // ld e,a
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x514d, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x514f, 10); // inc iy
    regs.djnz();
    m.step(regs.b !== 0 ? 0x5126 : 0x5151, regs.b !== 0 ? 13 : 8); // djnz 0x5126
  } while (regs.b !== 0);

  m.ret(10); // ret (0x5151)
}
