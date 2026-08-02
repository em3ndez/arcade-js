// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c8f  (ROM 0x2C8F–0x2CB7) — three-way twin of entry_2c03 / sub_03a2.
 *
 *   2c8f  3e 01        ld   a,0x01
 *   2c91  f7           rst  0x30
 *   2c92  d7           rst  0x10
 *   2c93  3a 93 63     ld   a,(0x6393)
 *   2c96  0f           rrca
 *   2c97  da 15 2d     jp   c,0x2d15
 *   2c9a  3a 92 63     ld   a,(0x6392)
 *   2c9d  0f           rrca
 *   2c9e  d0           ret  nc
 *   2c9f  dd 21 00 67  ld   ix,0x6700
 *   2ca3  11 20 00     ld   de,0x0020
 *   2ca6  06 0a        ld   b,0x0a
 * loc_2ca8:
 *   2ca8  dd 7e 00     ld   a,(ix+0x00)
 *   2cab  0f           rrca
 *   2cac  da b3 2c     jp   c,0x2cb3
 *   2caf  0f           rrca
 *   2cb0  d2 b8 2c     jp   nc,0x2cb8
 * loc_2cb3:
 *   2cb3  dd 19        add  ix,de
 *   2cb5  10 f1        djnz 0x2ca8
 *   2cb7  c9           ret
 *
 * Prologue IDENTICAL to the translated twin sub_03a2 (mainloop.js) for the
 * first five instructions -- ld a,n / rst 0x30 / rst 0x10 / ld a,(nn) / rrca --
 * then DIVERGES: sub_03a2 (and the sibling draft entry_2c03) do `ret c` (d8);
 * this does `jp c,0x2d15` (da 15 2d). A translator copying the twin here would
 * return instead of jumping. The rst 0x30/0x10 gates are
 * the standard caller-skip pair (sub_0030/sub_0010); when either skips, control
 * returns to OUR caller -- mirrors sub_03a2 exactly.
 *
 * Scans 10 records at 0x6700 (stride 0x20) testing bits 0/1 of (ix+0): bit 0
 * set -> advance; bit 1 clear -> the free-slot path at entry_2cb8. add ix,de is
 * INSIDE the loop (djnz target 0x2CA8 is above it) -- hoisting breaks the walk.
 *
 * FLOW-OUTS, both <0x3000 but UNTRANSLATED, rendered as NotImplemented throws
 * (the loc_1dc9 convention): 0x2d15 (jp c, the (0x6393)-bit-0 path) and
 * entry_2cb8 (jp nc, the free-slot-found path). Both are tail jumps -- this
 * routine hands off, it does not call. Not yet wired into the live dispatcher.
 */
export function loc_2c8f(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x2c91, 7); // ld a,0x01

  m.push16(0x2c92);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // rst 0x30 skipped OUR body -> back to our caller

  m.push16(0x2c93);
  m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return; // rst 0x10 skipped OUR body -> back to our caller

  regs.a = mem.read8(0x6393);
  m.step(0x2c96, 13); // ld a,(0x6393)
  regs.rrca();
  m.step(0x2c97, 4); // rrca -- carry = bit 0 of (0x6393)
  if (regs.fC) {
    m.step(0x2d15, 10); // jp c,0x2d15 taken (tail)
    return m.call(0x2d15);
  }
  m.step(0x2c9a, 10); // jp c,0x2d15 not taken

  regs.a = mem.read8(0x6392);
  m.step(0x2c9d, 13); // ld a,(0x6392)
  regs.rrca();
  m.step(0x2c9e, 4); // rrca -- carry = bit 0 of (0x6392)
  if (regs.fNC) {
    m.ret(11); // ret nc -- (0x6392) bit 0 clear
    return;
  }
  m.step(0x2c9f, 5); // ret nc not taken

  regs.ix = 0x6700;
  m.step(0x2ca3, 14); // ld ix,0x6700
  regs.de = 0x0020;
  m.step(0x2ca6, 10); // ld de,0x0020
  regs.b = 0x0a;
  m.step(0x2ca8, 7); // ld b,0x0a

  do {
    // loc_2ca8: scan one record for a free slot
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x2cab, 19); // ld a,(ix+0x00)
    regs.rrca();
    m.step(0x2cac, 4); // rrca -- carry = bit 0 of (ix+0)
    if (regs.fC) {
      m.step(0x2cb3, 10); // jp c,0x2cb3 taken -- bit 0 set, advance
    } else {
      m.step(0x2caf, 10); // jp c,0x2cb3 not taken
      regs.rrca();
      m.step(0x2cb0, 4); // rrca -- carry = bit 1 of (ix+0)
      if (regs.fNC) {
        m.step(0x2cb8, 10); // jp nc,0x2cb8 taken (tail) -- bit 1 clear, free slot
        return m.call(0x2cb8);
      }
      m.step(0x2cb3, 10); // jp nc,0x2cb8 not taken -> fall to loc_2cb3
    }
    // loc_2cb3:
    regs.addIx(regs.de);
    m.step(0x2cb5, 15); // add ix,de -- INSIDE the loop (draft TEST 2)
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2ca8 : 0x2cb7, regs.b !== 0 ? 13 : 8); // djnz 0x2ca8
  } while (regs.b !== 0);

  m.ret(); // 0x2CB7 -- 10-record scan exhausted, no free slot
}
