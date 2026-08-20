// SPDX-License-Identifier: GPL-3.0-only

// loc_5f11  (ROM 0x5f11-0x5f52) -- djnz collision scan over B sprite slots (IX stride 4, HL stride
// 0x18). Empty (0) or state-3 slots are skipped. For a live slot loc_5f53 yields E (screen X) and A
// (screen Y, carry=on-screen); |dx| vs (iy+0) must be < 7 and |dy| vs (iy+2)+8 < 6 for a hit. A hit
// marks the slot state 3, sets a flash cell at 0x8d19 (+I via `ld a,i`), and tails into loc_5f02.
export function loc_5f11(m) {
  const { regs, mem } = m;

  for (;;) { // loc_5f11: per-slot scan
    regs.a = mem.read8(regs.hl);                 m.step(0x5f12, 7);
    regs.and(regs.a);                            m.step(0x5f13, 4);
    if (regs.fZ) {
      m.step(0x5f47, 12);                        // jr z,0x5f47 -- empty slot
    } else {
      m.step(0x5f15, 7);
      regs.cp(0x03);                             m.step(0x5f17, 7);
      if (regs.fZ) {
        m.step(0x5f47, 12);                      // jr z,0x5f47 -- already state 3
      } else {
        m.step(0x5f19, 7);
        m.push16(0x5f1c);
        m.step(0x5f53, 17);                      // 5f19  call 0x5f53
        m.call(0x5f53);
        if (regs.fNC) {
          m.step(0x5f47, 12);                    // jr nc,0x5f47 -- off-screen
        } else {
          m.step(0x5f1e, 7);
          regs.d = regs.a;                       m.step(0x5f1f, 4);
          regs.a = mem.read8((regs.iy + 0) & 0xffff); m.step(0x5f22, 19);
          regs.sub(regs.e);                      m.step(0x5f23, 4);
          if (regs.fNC) {
            m.step(0x5f27, 12);                  // jr nc,0x5f27
          } else {
            m.step(0x5f25, 7);
            regs.neg();                          m.step(0x5f27, 8); // |dx|
          }
          regs.cp(0x07);                         m.step(0x5f29, 7);
          if (regs.fNC) {
            m.step(0x5f47, 12);                  // jr nc,0x5f47 -- dx >= 7
          } else {
            m.step(0x5f2b, 7);
            regs.a = mem.read8((regs.iy + 2) & 0xffff); m.step(0x5f2e, 19);
            regs.add(0x08);                      m.step(0x5f30, 7);
            regs.sub(regs.d);                    m.step(0x5f31, 4);
            if (regs.fNC) {
              m.step(0x5f35, 12);                // jr nc,0x5f35
            } else {
              m.step(0x5f33, 7);
              regs.neg();                        m.step(0x5f35, 8); // |dy|
            }
            regs.cp(0x06);                       m.step(0x5f37, 7);
            if (regs.fNC) {
              m.step(0x5f47, 12);                // jr nc,0x5f47 -- dy >= 6
            } else {
              // loc_5f39: hit -- mark slot, flash cell, tail into loc_5f02
              m.step(0x5f39, 7);                 // jr nc not taken
              mem.write8(regs.hl, 0x03);         m.step(0x5f3b, 10);
              regs.hl = 0x8d19;                  m.step(0x5f3e, 10);
              regs.ldAI();                       m.step(0x5f40, 9); // A <- I, Z when I==0
              if (regs.fZ) {
                m.step(0x5f43, 12);              // jr z,0x5f43
              } else {
                m.step(0x5f42, 7);
                regs.l = regs.inc8(regs.l);      m.step(0x5f43, 4);
              }
              mem.write8(regs.hl, 0x01);         m.step(0x5f45, 10);
              m.step(0x5f02, 12);                // jr 0x5f02 (tail, reuses caller frame)
              return m.call(0x5f02);
            }
          }
        }
      }
    }

    // loc_5f47: advance IX/HL to the next slot, loop while B != 0
    regs.de = 0x0004;                            m.step(0x5f4a, 10);
    regs.addIx(regs.de);                         m.step(0x5f4c, 15);
    regs.de = 0x0018;                            m.step(0x5f4f, 10);
    regs.addHl(regs.de);                         m.step(0x5f50, 11);
    if (regs.djnz()) { m.step(0x5f11, 13); } else { m.step(0x5f52, 8); return m.ret(10); }
  }
}
