// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_07ad  (ROM 0x07AD–0x07C2).
 *
 *   07ad  73           ld   (hl),e
 *   07ae  23           inc  hl
 *   07af  23           inc  hl
 *   07b0  72           ld   (hl),d
 *   07b1  7a           ld   a,d
 *   07b2  d6 0a        sub  0x0a
 *   07b4  c2 bc 07     jp   nz,0x07bc
 *   07b7  77           ld   (hl),a
 *   07b8  3c           inc  a
 *   07b9  32 8e 75     ld   (0x758e),a
 *   07bc  11 01 02     ld   de,0x0201
 *   07bf  21 8c 76     ld   hl,0x768c
 *   07c2  c9           ret
 *
 * Writes E and D two bytes apart in video RAM -- the gap is because tilemap
 * columns are 2 apart in this address layout, so this is placing two digits
 * side by side, not writing a 16-bit value.
 *
 * The `sub 0x0a` is a comparison that KEEPS its result: when D is exactly 10
 * the zero it computed is stored as the tile, turning a would-be "10" into a
 * literal 0 digit and setting the carry digit at 0x758E. So the branch is
 * both the test and the arithmetic, which is why `ld (hl),a` can store A
 * without reloading it.
 *
 * Ends by loading DE and HL with the SECOND pass's arguments. It does not
 * preserve them -- it hands them over, which is the whole mechanism behind
 * the call-then-fall-through at 0x07AA.
 */
export function sub_07ad(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, regs.e);
  m.step(0x07ae, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x07af, 6);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x07b0, 6);
  mem.write8(regs.hl, regs.d);
  m.step(0x07b1, 7);
  regs.a = regs.d;
  m.step(0x07b2, 4);
  // `regs.sub` MUTATES A and returns nothing, unlike `regs.inc8` which is
  // pure and returns its result. The two call sites look identical, so
  // `regs.a = regs.sub(...)` silently stores undefined -- and then survives
  // because `write8` masks it to 0, which happens to be the right byte on
  // the Z path. It would have gone unnoticed until the digit reached 10.
  regs.sub(0x0a);
  m.step(0x07b4, 7);

  if (!regs.fZ) {
    m.step(0x07bc, 10);
  } else {
    m.step(0x07b7, 10);
    mem.write8(regs.hl, regs.a);
    m.step(0x07b8, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x07b9, 4);
    mem.write8(0x758e, regs.a);
    m.step(0x07bc, 13);
  }

  regs.de = 0x0201;
  m.step(0x07bf, 10);
  regs.hl = 0x768c;
  m.step(0x07c2, 10);
  m.ret();
}
