// SPDX-License-Identifier: GPL-3.0-only

// loc_5211  (ROM 0x5211–0x5269)
export function loc_5211(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  for (;;) {
    regs.a = mem.read8(X(0x00));
    m.step(0x5214, 19); // ld a,(ix+0x00)
    regs.a = regs.inc8(regs.a);
    m.step(0x5215, 4); // inc a

    if (regs.fNZ) {
      m.step(0x5254, 12); // jr nz,0x5254
    } else {
      m.step(0x5217, 7); // jr nz -- not taken

      do {
        advance: {
          regs.a = mem.read8(regs.de);
          m.step(0x5218, 7); // ld a,(de)
          regs.a = regs.inc8(regs.a);
          m.step(0x5219, 4); // inc a
          if (regs.fNZ) { m.step(0x524a, 12); break advance; } // jr nz,0x524a
          m.step(0x521b, 7);

          regs.a = mem.read8(Y(0x00));
          m.step(0x521e, 19); // ld a,(iy+0x00)
          regs.add(0x08);
          m.step(0x5220, 7); // add a,0x08
          regs.cp(0x19);
          m.step(0x5222, 7); // cp 0x19
          if (regs.fC) { m.step(0x524a, 12); break advance; } // jr c,0x524a
          m.step(0x5224, 7);

          regs.a = mem.read8(Y(0x31));
          m.step(0x5227, 19); // ld a,(iy+0x31)
          regs.add(0x10);
          m.step(0x5229, 7); // add a,0x10
          regs.cp(0x11);
          m.step(0x522b, 7); // cp 0x11
          if (regs.fC) { m.step(0x524a, 12); break advance; } // jr c,0x524a
          m.step(0x522d, 7);

          regs.a = mem.read8(X(0x06));
          m.step(0x5230, 19); // ld a,(ix+0x06)
          regs.sub(mem.read8(Y(0x00)));
          m.step(0x5233, 19); // sub (iy+0x00)
          regs.add(regs.l);
          m.step(0x5234, 4); // add a,l
          regs.cp(regs.h);
          m.step(0x5235, 4); // cp h
          if (regs.fNC) { m.step(0x524a, 12); break advance; } // jr nc,0x524a
          m.step(0x5237, 7);

          regs.a = mem.read8(X(0x04));
          m.step(0x523a, 19); // ld a,(ix+0x04)
          regs.sub(mem.read8(Y(0x31)));
          m.step(0x523d, 19); // sub (iy+0x31)
          regs.add(regs.l);
          m.step(0x523e, 4); // add a,l
          regs.cp(regs.h);
          m.step(0x523f, 4); // cp h
          if (regs.fNC) { m.step(0x524a, 12); break advance; } // jr nc,0x524a
          m.step(0x5241, 7);

          regs.a = 0xf0;
          m.step(0x5243, 7); // ld a,0xf0
          mem.write8(X(0x00), regs.a);
          m.step(0x5246, 19); // ld (ix+0x00),a
          mem.write8(regs.de, regs.a);
          m.step(0x5247, 7); // ld (de),a
          m.push16(0x524a);
          m.step(0x51de, 17); // call 0x51de
          m.call(0x51de);
        }

        regs.a = regs.e;
        m.step(0x524b, 4); // ld a,e
        regs.add(0x10);
        m.step(0x524d, 7); // add a,0x10
        regs.e = regs.a;
        m.step(0x524e, 4); // ld e,a
        regs.iy = regs.iy + 1;
        m.step(0x5250, 10); // inc iy
        regs.iy = regs.iy + 1;
        m.step(0x5252, 10); // inc iy
        regs.djnz();
        m.step(regs.b !== 0 ? 0x5217 : 0x5254, regs.b !== 0 ? 13 : 8); // djnz 0x5217
      } while (regs.b !== 0);
    }

    regs.iy = mem.read16(0xa991);
    m.step(0x5258, 20); // ld iy,(0xa991)
    regs.de = mem.read16(0xa993);
    m.step(0x525c, 20); // ld de,(0xa993)
    regs.exAf();
    m.step(0x525d, 4); // ex af,af'
    regs.b = regs.a;
    m.step(0x525e, 4); // ld b,a
    regs.exAf();
    m.step(0x525f, 4); // ex af,af'
    regs.a = regs.ix & 0xff;
    m.step(0x5261, 8); // ld a,ixl
    regs.add(0x10);
    m.step(0x5263, 7); // add a,0x10
    regs.ix = (regs.ix & 0xff00) | regs.a;
    m.step(0x5265, 8); // ld ixl,a -- 8-bit: no carry into IXH
    regs.c = regs.dec8(regs.c);
    m.step(0x5266, 4); // dec c
    if (regs.fNZ) {
      m.step(0x5211, 10); // jp nz,0x5211
      continue;
    }
    m.step(0x5269, 10); // jp nz -- not taken
    break;
  }

  m.ret(10); // ret (0x5269)
}
