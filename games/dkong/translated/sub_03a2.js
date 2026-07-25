// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_03a2  (ROM 0x03A2–0x03F1) — game-state-1 periodic event servicing, gated three deep (+ its callee sub_03f2).
 *
 *   03a2  3e 03        ld   a,0x03
 *   03a4  f7           rst  0x30
 *   03a5  d7           rst  0x10
 *   03a6  3a 50 63     ld   a,(0x6350)
 *   03a9  0f           rrca
 *   03aa  d8           ret  c
 *   03ab  21 b8 62     ld   hl,0x62b8
 *   03ae  35           dec  (hl)
 *   03af  c0           ret  nz
 *   03b0  36 04        ld   (hl),0x04
 *   03b2  3a b9 62     ld   a,(0x62b9)
 *   03b5  0f           rrca
 *   03b6  d0           ret  nc
 *   03b7  21 29 6a     ld   hl,0x6a29
 *   03ba  06 40        ld   b,0x40
 *   03bc  dd 21 a0 66  ld   ix,0x66a0
 *   03c0  0f           rrca
 *   03c1  d2 e4 03     jp   nc,0x03e4
 *   03c4  dd 36 09 02  ld   (ix+0x09),0x02
 *   03c8  dd 36 0a 02  ld   (ix+0x0a),0x02
 *   03cc  04           inc  b
 *   03cd  04           inc  b
 *   03ce  cd f2 03     call 0x03f2
 *   03d1  21 ba 62     ld   hl,0x62ba
 *   03d4  35           dec  (hl)
 *   03d5  c0           ret  nz
 *   03d6  3e 01        ld   a,0x01
 *   03d8  32 b9 62     ld   (0x62b9),a
 *   03db  32 a0 63     ld   (0x63a0),a
 *   03de  3e 10        ld   a,0x10          ; loc_03de
 *   03e0  32 ba 62     ld   (0x62ba),a
 *   03e3  c9           ret
 *   03e4  dd 36 09 02  ld   (ix+0x09),0x02  ; loc_03e4
 *   03e8  dd 36 0a 00  ld   (ix+0x0a),0x00
 *   03ec  cd f2 03     call 0x03f2
 *   03ef  c3 de 03     jp   0x03de
 *
 * Reached in game state 1 once BOTH the rst 0x30 and rst 0x10 gates pass. It
 * services a periodic event, gated three deep: a bit of (0x6350), then a
 * countdown at 0x62B8 reloaded to 4, then a bit of (0x62B9). The `rrca`s test
 * bit 0 into carry and the `ret c`/`ret nc` are the early exits.
 *
 * THE 0x03C0 rrca TESTS THE SAME (0x62B9) BIT AGAIN -- 0x03B5 rotated it into
 * carry and exited on nc; the value is still in A, so 0x03C0 rotates the NEXT
 * bit up. The two-way split at 0x03C1 (jp nc) writes (ix+0x0A) as 0x02 or 0x00
 * accordingly -- the only difference between the two arms, both of which then
 * call 0x03F2 and converge at loc_03de.
 *
 * B = 0x40 then two `inc b` on the 0x03C4 arm (-> 0x42) is the value 0x03F2
 * stores at (HL) = 0x6A29; the 0x03E4 arm leaves B = 0x40. sub_03f2 conditions
 * a second store on a bit of (0x6019).
 */
export function sub_03a2(m) {
  const { regs, mem } = m;

  regs.a = 0x03;
  m.step(0x03a4, 7);

  m.push16(0x03a5);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return;

  m.push16(0x03a6);
  m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return;

  regs.a = mem.read8(0x6350);
  m.step(0x03a9, 13); // ld a,(0x6350)
  regs.rrca();
  m.step(0x03aa, 4); // rrca
  if (regs.fC) {
    m.ret(11); // ret c
    return;
  }
  m.step(0x03ab, 5); // ret c not taken

  regs.hl = 0x62b8;
  m.step(0x03ae, 10); // ld hl,0x62b8
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8); // dec (hl)
  m.step(0x03af, 11);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- counter has not reached 0
    return;
  }
  m.step(0x03b0, 5); // ret nz not taken

  mem.write8(regs.hl, 0x04); // reload the 0x62B8 counter
  m.step(0x03b2, 10); // ld (hl),0x04
  regs.a = mem.read8(0x62b9);
  m.step(0x03b5, 13); // ld a,(0x62b9)
  regs.rrca();
  m.step(0x03b6, 4); // rrca -- tests bit 0 of (0x62B9)
  if (regs.fNC) {
    m.ret(11); // ret nc
    return;
  }
  m.step(0x03b7, 5); // ret nc not taken

  regs.hl = 0x6a29;
  m.step(0x03ba, 10); // ld hl,0x6a29
  regs.b = 0x40;
  m.step(0x03bc, 7); // ld b,0x40
  regs.ix = 0x66a0;
  m.step(0x03c0, 14); // ld ix,0x66a0
  regs.rrca();
  m.step(0x03c1, 4); // rrca -- the NEXT bit of (0x62B9), still in A

  if (regs.fNC) {
    m.step(0x03e4, 10); // jp nc,0x03e4
    mem.write8((regs.ix + 0x09) & 0xffff, 0x02);
    m.step(0x03e8, 19); // ld (ix+0x09),0x02
    mem.write8((regs.ix + 0x0a) & 0xffff, 0x00);
    m.step(0x03ec, 19); // ld (ix+0x0a),0x00
    m.push16(0x03ef);
    m.step(0x03f2, 17); // call 0x03f2
    m.call(0x03f2);
    m.step(0x03de, 10); // jp 0x03de
  } else {
    m.step(0x03c4, 10); // jp nc not taken
    mem.write8((regs.ix + 0x09) & 0xffff, 0x02);
    m.step(0x03c8, 19); // ld (ix+0x09),0x02
    mem.write8((regs.ix + 0x0a) & 0xffff, 0x02);
    m.step(0x03cc, 19); // ld (ix+0x0a),0x02
    regs.b = regs.inc8(regs.b);
    m.step(0x03cd, 4); // inc b
    regs.b = regs.inc8(regs.b);
    m.step(0x03ce, 4); // inc b  -- B = 0x42
    m.push16(0x03d1);
    m.step(0x03f2, 17); // call 0x03f2
    m.call(0x03f2);

    regs.hl = 0x62ba;
    m.step(0x03d4, 10); // ld hl,0x62ba
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8); // dec (hl)
    m.step(0x03d5, 11);
    if (regs.fNZ) {
      m.ret(11); // ret nz
      return;
    }
    m.step(0x03d6, 5); // ret nz not taken

    regs.a = 0x01;
    m.step(0x03d8, 7); // ld a,0x01
    mem.write8(0x62b9, regs.a);
    m.step(0x03db, 13); // ld (0x62b9),a
    mem.write8(0x63a0, regs.a);
    m.step(0x03de, 13); // ld (0x63a0),a
  }

  // loc_03de -- both arms converge here.
  regs.a = 0x10;
  m.step(0x03e0, 7); // ld a,0x10
  mem.write8(0x62ba, regs.a);
  m.step(0x03e3, 13); // ld (0x62ba),a

  m.ret(); // 03e3
}
