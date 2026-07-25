// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2c03  (ROM 0x2C03–0x2C40) — head of the 0x2C.. cluster; one caller @ 0x1989.
 *
 *   2c03  3e 01        ld   a,0x01
 *   2c05  f7           rst  0x30
 *   2c06  d7           rst  0x10
 *   2c07  3a 93 63     ld   a,(0x6393)
 *   2c0a  0f           rrca
 *   2c0b  d8           ret  c
 *   2c0c  3a b1 62     ld   a,(0x62b1)
 *   2c0f  a7           and  a
 *   2c10  c8           ret  z
 *   2c11  4f           ld   c,a
 *   2c12  3a b0 62     ld   a,(0x62b0)
 *   2c15  d6 02        sub  0x02
 *   2c17  b9           cp   c
 *   2c18  da 7b 2c     jp   c,0x2c7b
 *   2c1b  3a 82 63     ld   a,(0x6382)
 *   2c1e  cb 4f        bit  1,a
 *   2c20  c2 86 2c     jp   nz,0x2c86
 *   2c23  3a 80 63     ld   a,(0x6380)
 *   2c26  47           ld   b,a
 *   2c27  3a 1a 60     ld   a,(0x601a)
 *   2c2a  e6 1f        and  0x1f
 *   2c2c  b8           cp   b          ; loc_2c2c
 *   2c2d  ca 33 2c     jp   z,0x2c33
 *   2c30  10 fa        djnz 0x2c2c
 *   2c32  c9           ret
 *   2c33  3a b0 62     ld   a,(0x62b0) ; loc_2c33
 *   2c36  cb 3f        srl  a
 *   2c38  b9           cp   c
 *   2c39  da 41 2c     jp   c,0x2c41
 *   2c3c  3a 19 60     ld   a,(0x6019)
 *   2c3f  0f           rrca
 *   2c40  d0           ret  nc
 *
 * TWIN of sub_03a2 (mainloop.js) -- SAME rst 0x30/0x10 prologue, constants
 * 0x01/0x6393 not 0x03/0x6350. A copy of the twin reads the wrong cell.
 * The two rst are the conditional caller-skip pair (sub_0030/
 * sub_0010); each `if (!..) return;` -- modelling either as a plain call loses
 * the skip. srl a @ 0x2C36 is the first use of the primitive:
 * LOGICAL (0 into bit 7), not sra. The djnz loop's `cp b` is
 * INSIDE the loop and B decrements, so it matches A against B, B-1, .., 1 -- the
 * compare is not loop-invariant.
 *
 * FLOW-OUTS to the untranslated 0x2C.. cluster, rendered as NotImplemented throws
 * (the loc_1dc9 convention): 0x2c7b (jp c), 0x2c86 (jp nz), and 0x2c41 -- reached
 * BOTH by jp c @ 0x2C39 AND by fall-through when `ret nc` @ 0x2C40 is not taken
 * (the invisible-boundary continuation). Not yet wired into the live
 * dispatcher; only caller 0x1989 is itself untranslated.
 */
export function entry_2c03(m) {
  const { regs, mem } = m;

  regs.a = 0x01; // ld a,0x01 -- NOT 0x03 (twin sub_03a2)
  m.step(0x2c05, 7); // ld a,0x01
  m.push16(0x2c06);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // rst 0x30 -- may SKIP
  m.push16(0x2c07);
  m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return; // rst 0x10 -- may SKIP

  regs.a = mem.read8(0x6393); // NOT 0x6350 (twin sub_03a2)
  m.step(0x2c0a, 13); // ld a,(0x6393)
  regs.rrca();
  m.step(0x2c0b, 4); // rrca -- carry = bit 0 of (0x6393)
  if (regs.fC) {
    m.ret(11); // ret c -- (0x6393) bit 0 set
    return;
  }
  m.step(0x2c0c, 5); // ret c not taken

  regs.a = mem.read8(0x62b1);
  m.step(0x2c0f, 13); // ld a,(0x62b1)
  regs.and(regs.a); // and a -- test A for zero
  m.step(0x2c10, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- (0x62b1) == 0
    return;
  }
  m.step(0x2c11, 5); // ret z not taken
  regs.c = regs.a;
  m.step(0x2c12, 4); // ld c,a -- C := (0x62b1)

  regs.a = mem.read8(0x62b0);
  m.step(0x2c15, 13); // ld a,(0x62b0)
  regs.sub(0x02);
  m.step(0x2c17, 7); // sub 0x02
  regs.cp(regs.c);
  m.step(0x2c18, 4); // cp c
  if (regs.fC) {
    m.step(0x2c7b, 10); // jp c,0x2c7b taken (tail)
    return m.call(0x2c7b);
  }
  m.step(0x2c1b, 10); // jp c,0x2c7b not taken

  regs.a = mem.read8(0x6382);
  m.step(0x2c1e, 13); // ld a,(0x6382)
  const bit1 = regs.bit(1, regs.a); // bit 1,a -- F3/F5-from-value correct for reg form
  m.step(0x2c20, 8); // bit 1,a
  if (bit1) {
    m.step(0x2c86, 10); // jp nz,0x2c86 taken (tail)
    return m.call(0x2c86);
  }
  m.step(0x2c23, 10); // jp nz,0x2c86 not taken

  regs.a = mem.read8(0x6380);
  m.step(0x2c26, 13); // ld a,(0x6380)
  regs.b = regs.a;
  m.step(0x2c27, 4); // ld b,a -- B := (0x6380)
  regs.a = mem.read8(0x601a);
  m.step(0x2c2a, 13); // ld a,(0x601a)
  regs.and(0x1f);
  m.step(0x2c2c, 7); // and 0x1f

  for (;;) {
    // loc_2c2c: cp b is INSIDE the loop; djnz decrements B, so the compare tests
    // A against B, B-1, .., 1 -- NOT loop-invariant.
    regs.cp(regs.b);
    m.step(0x2c2d, 4); // cp b
    if (regs.fZ) {
      m.step(0x2c33, 10); // jp z,0x2c33 taken -> loc_2c33
      break;
    }
    m.step(0x2c30, 10); // jp z,0x2c33 not taken
    regs.djnz();
    if (regs.b === 0) {
      m.step(0x2c32, 8); // djnz falls through
      m.ret(); // 0x2C32 -- no match in [1,(0x6380)]
      return;
    }
    m.step(0x2c2c, 13); // djnz taken -> loc_2c2c
  }

  // ---- loc_2c33 ----
  regs.a = mem.read8(0x62b0);
  m.step(0x2c36, 13); // ld a,(0x62b0)
  regs.a = regs.srl(regs.a); // srl a -- LOGICAL (0 into bit 7), NOT sra
  m.step(0x2c38, 8); // srl a
  regs.cp(regs.c);
  m.step(0x2c39, 4); // cp c
  if (regs.fC) {
    m.step(0x2c41, 10); // jp c,0x2c41 taken (tail)
    return m.call(0x2c41);
  }
  m.step(0x2c3c, 10); // jp c,0x2c41 not taken

  regs.a = mem.read8(0x6019);
  m.step(0x2c3f, 13); // ld a,(0x6019)
  regs.rrca();
  m.step(0x2c40, 4); // rrca -- carry = bit 0 of (0x6019)
  if (regs.fNC) {
    m.ret(11); // ret nc -- (0x6019) bit 0 clear
    return;
  }
  m.step(0x2c41, 5); // ret nc not taken -- FALL-THROUGH into entry_2c41
  return m.call(0x2c41);
}
