// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2591  (ROM 0x2591–0x25EF).
 */
export function loc_2591(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.ix = 0x65a0;
  m.step(0x2595, 14); // ld ix,0x65a0
  regs.de = 0x0010; // LIVE-OUT -- do not clobber
  m.step(0x2598, 10); // ld de,0x0010
  regs.b = 0x06;
  m.step(0x259a, 7); // ld b,0x06

  for (;;) {
    // -- loc_259a: per-slot; all paths converge at 0x25BB --
    let doCull = false;
    regs.bit(0, mem.read8(IX(0x00)));
    m.step(0x259e, 20); // bit 0,(ix+0x00)

    if (regs.fZ) {
      m.step(0x25bb, 10); // jp z,0x25bb -- inactive slot
    } else {
      m.step(0x25a1, 10); // jp z not taken
      regs.a = mem.read8(IX(0x03));
      m.step(0x25a4, 19); // ld a,(ix+0x03)
      regs.h = regs.a; // H = ORIGINAL field3
      m.step(0x25a5, 4); // ld h,a
      regs.add(0x07); // scratch copy
      m.step(0x25a7, 7); // add a,0x07
      regs.cp(0x0e);
      m.step(0x25a9, 7); // cp 0x0e
      if (regs.fC) {
        doCull = true;
        m.step(0x25d6, 10); // jp c,0x25d6 -- (field3+7) < 0x0E
      } else {
        m.step(0x25ac, 10); // jp c not taken
        regs.a = mem.read8(IX(0x05));
        m.step(0x25af, 19); // ld a,(ix+0x05)
        regs.cp(0x7c);
        m.step(0x25b1, 7); // cp 0x7c
        if (regs.fZ) {
          // -- loc_25c0: field5 == 0x7C --
          m.step(0x25c0, 10); // jp z,0x25c0
          regs.a = regs.h;
          m.step(0x25c1, 4); // ld a,h
          regs.cp(0x80);
          m.step(0x25c3, 7); // cp 0x80
          if (regs.fZ) {
            doCull = true;
            m.step(0x25d6, 10); // jp z,0x25d6 -- field3 == 0x80
          } else {
            if (regs.fNC) {
              m.step(0x25c9, 13); // jp z not taken -- field3 > 0x80
              regs.a = mem.read8(0x63a5);
              m.step(0x25cf, 10); // jp nc,0x25cf
            } else {
              m.step(0x25cc, 10); // jp nc not taken -- field3 < 0x80
              regs.a = mem.read8(0x63a4);
              m.step(0x25cf, 13); // ld a,(0x63a4)
            }
            regs.add(regs.h);
            m.step(0x25d0, 4); // add a,h
            mem.write8(IX(0x03), regs.a);
            m.step(0x25d3, 19); // ld (ix+0x03),a
            m.step(0x25bb, 10); // jp 0x25bb
          }
        } else {
          m.step(0x25b4, 10); // jp z not taken -- field5 != 0x7C
          regs.a = mem.read8(0x63a6);
          m.step(0x25b7, 13); // ld a,(0x63a6)
          regs.add(regs.h);
          m.step(0x25b8, 4); // add a,h
          mem.write8(IX(0x03), regs.a);
          m.step(0x25bb, 19); // ld (ix+0x03),a
        }
      }

      if (doCull) {
        // -- loc_25d6: cull --
        regs.hl = 0x69b8;
        m.step(0x25d9, 10); // ld hl,0x69b8
        regs.a = 0x06;
        m.step(0x25db, 7); // ld a,0x06
        regs.sub(regs.b); // A = 6 - B = slot index
        m.step(0x25dc, 4); // sub b
        for (;;) {
          // -- loc_25dc: advance HL by 4 per remaining slot index --
          if (regs.fZ) {
            m.step(0x25e7, 10); // jp z,0x25e7
            break;
          }
          m.step(0x25df, 10); // jp z not taken
          regs.l = regs.inc8(regs.l);
          m.step(0x25e0, 4);
          regs.l = regs.inc8(regs.l);
          m.step(0x25e1, 4);
          regs.l = regs.inc8(regs.l);
          m.step(0x25e2, 4);
          regs.l = regs.inc8(regs.l);
          m.step(0x25e3, 4);
          regs.a = regs.dec8(regs.a);
          m.step(0x25e4, 4);
          m.step(0x25dc, 10); // jp 0x25dc
        }
        regs.xor(regs.a); // A = 0
        m.step(0x25e8, 4);
        mem.write8(IX(0x00), regs.a); // clear field0
        m.step(0x25eb, 19);
        mem.write8(IX(0x03), regs.a); // clear field3
        m.step(0x25ee, 19);
        mem.write8(regs.hl, regs.a); // clear the 0x69B8 record byte
        m.step(0x25ef, 7);
        m.step(0x25bb, 10); // jp 0x25bb
      }
    }

    // -- loc_25bb: advance to the next slot (shared by all paths) --
    regs.addIx(regs.de); // add ix,de -- DE stays 0x10
    m.step(0x25bd, 15);
    regs.djnz();
    if (regs.b !== 0) {
      m.step(0x259a, 13); // djnz 0x259a
      continue;
    }
    m.step(0x25bf, 8); // djnz not taken
    m.ret();
    return;
  }
}
