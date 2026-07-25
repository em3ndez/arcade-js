// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_29af  (ROM 0x29AF–0x2A21) — object-collision resolver over the 2913 search.
 *
 *   29af  3e 04        ld   a,0x04
 *   29b1  f7           rst  0x30            ; skips our body unless the bit is set
 *   29b2  fd 21 00 62  ld   iy,0x6200
 *   29b6  3a 05 62     ld   a,(0x6205)
 *   29b9  4f           ld   c,a
 *   29ba  21 08 04     ld   hl,0x0408
 *   29bd  cd 22 2a     call 0x2a22          ; -> entry_2913 search; A = hit/miss
 *   29c0  a7           and  a
 *   29c1  ca 20 2a     jp   z,0x2a20        ; miss -> plain ret
 *   29c4  3e 06        ld   a,0x06
 *   29c6  90           sub  b
 *   29c7  ca d0 29     jp   z,0x29d0        ; loc_29c7 loop head
 *   29ca  dd 19        add  ix,de
 *   29cc  3d           dec  a
 *   29cd  c3 c7 29     jp   0x29c7
 *   29d0  dd 7e 05     ld   a,(ix+0x05)
 *   29d3  d6 04        sub  0x04
 *   29d5  57           ld   d,a
 *   29d6  3a 0c 62     ld   a,(0x620c)
 *   29d9  c6 05        add  a,0x05
 *   29db  ba           cp   d
 *   29dc  d2 ee 29     jp   nc,0x29ee
 *   29df  7a           ld   a,d
 *   29e0  d6 08        sub  0x08
 *   29e2  32 05 62     ld   (0x6205),a
 *   29e5  3e 01        ld   a,0x01
 *   29e7  47           ld   b,a
 *   29e8  32 98 63     ld   (0x6398),a
 *   29eb  33           inc  sp
 *   29ec  33           inc  sp
 *   29ed  c9           ret                  ; SKIP -> caller's CALLER
 *   29ee  3a 0c 62     ld   a,(0x620c)
 *   29f1  d6 0e        sub  0x0e
 *   29f3  ba           cp   d
 *   29f4  d2 1b 2a     jp   nc,0x2a1b
 *   29f7  3a 10 62     ld   a,(0x6210)
 *   29fa  a7           and  a
 *   29fb  3a 03 62     ld   a,(0x6203)      ; FLAG-NEUTRAL -- Z below is `and a`'s
 *   29fe  ca 08 2a     jp   z,0x2a08
 *   2a01  f6 07        or   0x07
 *   2a03  d6 04        sub  0x04
 *   2a05  c3 0e 2a     jp   0x2a0e
 *   2a08  d6 08        sub  0x08            ; loc_2a08
 *   2a0a  f6 07        or   0x07
 *   2a0c  c6 04        add  a,0x04
 *   2a0e  32 03 62     ld   (0x6203),a      ; loc_2a0e
 *   2a11  32 4c 69     ld   (0x694c),a
 *   2a14  3e 01        ld   a,0x01
 *   2a16  06 00        ld   b,0x00
 *   2a18  33           inc  sp
 *   2a19  33           inc  sp
 *   2a1a  c9           ret                  ; SKIP -> caller's CALLER
 *   2a1b  af           xor  a               ; loc_2a1b
 *   2a1c  32 00 62     ld   (0x6200),a
 *   2a1f  c9           ret                  ; plain ret
 *   2a20  47           ld   b,a             ; loc_2a20
 *   2a21  c9           ret                  ; plain ret
 *
 * @returns {boolean} true when control reached OUR CALLER (rst-0x30 skip, or
 *   either plain ret); false for the two inc-sp exits, which skip the caller.
 */
export function sub_29af(m) {
  const { regs, mem } = m;

  // rst 0x30 -- and the boolean guard below is SILENT ABOUT REGISTERS, which are
  // part of the contract. sub_0030 CLOBBERS A (rrca'd B times), HL (:= 0x6227) and
  // B (djnz'd to 0). NOTHING is preserved across it here, deliberately: A is
  // reloaded from (0x6205), HL from the literal 0x0408, and B is set by sub_2a22.
  // DO NOT "helpfully" save/restore HL around this rst -- the ROM does not, the
  // pre-rst value is dead (sub_0030's first act is ld hl,0x6227), and preserving
  // it would corrupt a later (hl) user while every gate stayed green.
  regs.a = 0x04;
  m.step(0x29b1, 7); // ld a,0x04 -- the value sub_0030 rotates; NOT preserved
  m.push16(0x29b2); // rst 0x30 pushes its continuation
  m.step(0x0030, 11);
  if (!m.call(0x0030)) return true; // skipped OUR body; our caller still resumes

  regs.iy = 0x6200;
  m.step(0x29b6, 14); // ld iy,0x6200
  regs.a = mem.read8(0x6205);
  m.step(0x29b9, 13); // ld a,(0x6205)
  regs.c = regs.a;
  m.step(0x29ba, 4); // ld c,a
  regs.hl = 0x0408;
  m.step(0x29bd, 10); // ld hl,0x0408

  m.push16(0x29c0); // call 0x2a22
  m.step(0x2a22, 17);
  m.call(0x2a22); // both of its arms land us at 0x29C0; A carries hit/miss

  regs.and(regs.a);
  m.step(0x29c1, 4); // and a
  if (regs.fZ) {
    m.step(0x2a20, 10); // jp z,0x2a20 -- miss
    regs.b = regs.a;
    m.step(0x2a21, 4); // ld b,a
    m.ret(); // plain ret
    return true;
  }
  m.step(0x29c4, 10);

  regs.a = 0x06;
  m.step(0x29c6, 7); // ld a,0x06
  regs.sub(regs.b);
  m.step(0x29c7, 4); // sub b -- A = 6 - B

  // loc_29c7: hand-rolled countdown; add ix,de is INSIDE (draft TEST 2).
  for (;;) {
    if (regs.fZ) {
      m.step(0x29d0, 10); // jp z,0x29d0
      break;
    }
    m.step(0x29ca, 10);
    regs.addIx(regs.de);
    m.step(0x29cc, 15); // add ix,de
    regs.a = regs.dec8(regs.a);
    m.step(0x29cd, 4); // dec a
    m.step(0x29c7, 10); // jp 0x29c7
  }

  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x29d3, 19); // ld a,(ix+0x05)
  regs.sub(0x04);
  m.step(0x29d5, 7); // sub 0x04
  regs.d = regs.a;
  m.step(0x29d6, 4); // ld d,a
  regs.a = mem.read8(0x620c);
  m.step(0x29d9, 13); // ld a,(0x620c)
  regs.add(0x05);
  m.step(0x29db, 7); // add a,0x05
  regs.cp(regs.d);
  m.step(0x29dc, 4); // cp d
  if (!regs.fNC) {
    m.step(0x29df, 10); // jp nc NOT taken
    // ---- 0x29DF: SKIP EXIT 1 -- discards our return, lands in caller's caller
    regs.a = regs.d;
    m.step(0x29e0, 4); // ld a,d
    regs.sub(0x08);
    m.step(0x29e2, 7); // sub 0x08
    mem.write8(0x6205, regs.a);
    m.step(0x29e5, 13); // ld (0x6205),a
    regs.a = 0x01;
    m.step(0x29e7, 7); // ld a,0x01
    regs.b = regs.a;
    m.step(0x29e8, 4); // ld b,a
    mem.write8(0x6398, regs.a);
    m.step(0x29eb, 13); // ld (0x6398),a
    regs.sp = (regs.sp + 1) & 0xffff;
    m.step(0x29ec, 6); // inc sp
    regs.sp = (regs.sp + 1) & 0xffff;
    m.step(0x29ed, 6); // inc sp -- our return address discarded
    m.ret(); // -> the CALLER'S CALLER
    return false; // SKIPPED the caller
  }
  m.step(0x29ee, 10); // jp nc,0x29ee taken

  regs.a = mem.read8(0x620c);
  m.step(0x29f1, 13); // ld a,(0x620c)
  regs.sub(0x0e);
  m.step(0x29f3, 7); // sub 0x0e
  regs.cp(regs.d);
  m.step(0x29f4, 4); // cp d
  if (regs.fNC) {
    m.step(0x2a1b, 10); // jp nc,0x2a1b
    regs.xor(regs.a);
    m.step(0x2a1c, 4); // xor a
    mem.write8(0x6200, regs.a);
    m.step(0x2a1f, 13); // ld (0x6200),a
    m.ret(); // plain ret
    return true;
  }
  m.step(0x29f7, 10);

  regs.a = mem.read8(0x6210);
  m.step(0x29fa, 13); // ld a,(0x6210)
  regs.and(regs.a);
  m.step(0x29fb, 4); // and a -- sets the Z the jp z below reads
  regs.a = mem.read8(0x6203); // ld a,(0x6203) -- FLAG-NEUTRAL, `and a`'s Z survives
  m.step(0x29fe, 13);
  if (regs.fZ) {
    m.step(0x2a08, 10); // jp z,0x2a08
    regs.sub(0x08);
    m.step(0x2a0a, 7); // sub 0x08
    regs.or(0x07);
    m.step(0x2a0c, 7); // or 0x07
    regs.add(0x04);
    m.step(0x2a0e, 7); // add a,0x04
  } else {
    m.step(0x2a01, 10);
    regs.or(0x07);
    m.step(0x2a03, 7); // or 0x07
    regs.sub(0x04);
    m.step(0x2a05, 7); // sub 0x04
    m.step(0x2a0e, 10); // jp 0x2a0e
  }

  // ---- 0x2A0E: SKIP EXIT 2 -- discards our return, lands in caller's caller
  mem.write8(0x6203, regs.a);
  m.step(0x2a11, 13); // ld (0x6203),a
  mem.write8(0x694c, regs.a);
  m.step(0x2a14, 13); // ld (0x694c),a
  regs.a = 0x01;
  m.step(0x2a16, 7); // ld a,0x01
  regs.b = 0x00;
  m.step(0x2a18, 7); // ld b,0x00
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x2a19, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x2a1a, 6); // inc sp -- our return address discarded
  m.ret(); // -> the CALLER'S CALLER
  return false; // SKIPPED the caller
}
