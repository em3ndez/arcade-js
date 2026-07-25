// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_24b4  (ROM 0x24B4–0x24E9) — bounds gate; early ret or return-splice to 0x21ba.
 *
 *   24b4  dd 7e 05     ld   a,(ix+0x05)
 *   24b7  fe e8        cp   0xe8
 *   24b9  d8           ret  c            ; (ix+5) < 0xE8 -> RETURN
 *   24ba  dd 7e 03     ld   a,(ix+0x03)
 *   24bd  fe 2a        cp   0x2a
 *   24bf  d0           ret  nc           ; (ix+3) >= 0x2A -> RETURN
 *   24c0  fe 20        cp   0x20         ; SAME A -- range test on (ix+3)
 *   24c2  d8           ret  c            ; (ix+3) < 0x20 -> RETURN
 *   24c3  dd 7e 15     ld   a,(ix+0x15)
 *   24c6  a7           and  a
 *   24c7  ca d0 24     jp   z,0x24d0
 *   24ca  3e 03        ld   a,0x03
 *   24cc  32 b9 62     ld   (0x62b9),a
 *   24cf  af           xor  a
 *   24d0  dd 77 00     ld   (ix+0x00),a  ; loc_24d0 -- A=0 on both paths
 *   24d3  dd 77 03     ld   (ix+0x03),a
 *   24d6  21 82 60     ld   hl,0x6082
 *   24d9  36 03        ld   (hl),0x03
 *   24db  e1           pop  hl           ; pops the caller's return, forwarded to 0x21ba
 *   24dc  3a 48 63     ld   a,(0x6348)
 *   24df  a7           and  a
 *   24e0  c2 ba 21     jp   nz,0x21ba
 *   24e3  3c           inc  a
 *   24e4  32 48 63     ld   (0x6348),a   ; one-shot latch := 1
 *   24e7  c3 ba 21     jp   0x21ba       ; does NOT return to caller
 *
 * @returns {boolean} true when control returned to the caller (the three early
 *   rets). The main path does not return -- it throws (0x21ba untranslated).
 */
export function entry_24b4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x24b7, 19); // ld a,(ix+0x05)
  regs.cp(0xe8);
  m.step(0x24b9, 7); // cp 0xe8
  if (regs.fC) {
    m.ret(11); // ret c -- (ix+5) < 0xE8, normal return
    return true;
  }
  m.step(0x24ba, 5); // ret c not taken

  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x24bd, 19); // ld a,(ix+0x03)
  regs.cp(0x2a);
  m.step(0x24bf, 7); // cp 0x2a
  if (regs.fNC) {
    m.ret(11); // ret nc -- (ix+3) >= 0x2A
    return true;
  }
  m.step(0x24c0, 5); // ret nc not taken
  regs.cp(0x20); // cp 0x20 -- SAME A (ix+3), no reload; completes 0x20..0x29
  m.step(0x24c2, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- (ix+3) < 0x20
    return true;
  }
  m.step(0x24c3, 5); // ret c not taken

  regs.a = mem.read8((regs.ix + 0x15) & 0xffff);
  m.step(0x24c6, 19); // ld a,(ix+0x15)
  regs.and(regs.a);
  m.step(0x24c7, 4); // and a
  if (regs.fZ) {
    m.step(0x24d0, 10); // jp z,0x24d0 -- A already 0
  } else {
    m.step(0x24ca, 10); // jp z not taken
    regs.a = 0x03;
    m.step(0x24cc, 7); // ld a,0x03
    mem.write8(0x62b9, regs.a);
    m.step(0x24cf, 13); // ld (0x62b9),a -- shared cell := 3
    regs.xor(regs.a); // xor a -- A := 0
    m.step(0x24d0, 4);
  }

  // loc_24d0 -- A = 0 on both paths; reset (ix+0), (ix+3), then the splice.
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x24d3, 19); // ld (ix+0x00),a
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x24d6, 19); // ld (ix+0x03),a
  regs.hl = 0x6082;
  m.step(0x24d9, 10); // ld hl,0x6082
  mem.write8(regs.hl, 0x03);
  m.step(0x24db, 10); // ld (hl),0x03

  // *** RETURN SPLICE: pop the caller's return address into HL. NOT a discard --
  // it is forwarded live to 0x21ba (whose first op is exx). Control does NOT
  // return to this routine's caller from here.
  regs.hl = m.pop16();
  m.step(0x24dc, 10); // pop hl
  regs.a = mem.read8(0x6348);
  m.step(0x24df, 13); // ld a,(0x6348)
  regs.and(regs.a);
  m.step(0x24e0, 4); // and a
  if (regs.fNZ) {
    m.step(0x21ba, 10); // jp nz,0x21ba taken -- 0x6348 already non-zero
    m.call(0x21ba); // SPLICE -> 21ba's exx + the loop (forwards the popped caller-return in HL)
    return false; // skip-capable: signal caller NOT to continue inline (exx-parity fix)
  }
  m.step(0x24e3, 10); // jp nz not taken
  regs.a = regs.inc8(regs.a);
  m.step(0x24e4, 4); // inc a
  mem.write8(0x6348, regs.a);
  m.step(0x24e7, 13); // ld (0x6348),a -- one-shot latch := 1
  m.step(0x21ba, 10); // jp 0x21ba
  m.call(0x21ba); // SPLICE -> 21ba's exx + the loop (forwards the popped caller-return in HL)
  return false; // skip-capable: signal caller NOT to continue inline (exx-parity fix)
}
