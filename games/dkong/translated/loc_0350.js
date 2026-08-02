// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0350  (ROM 0x0350–0x037E) — packs a BCD score, tests the bonus threshold, awards an extra life; tail-jumps to 0x06B8.
 *
 *   0350  3a 2d 62     ld   a,(0x622d)
 *   0353  a7           and  a
 *   0354  c0           ret  nz
 *   0355  21 b3 60     ld   hl,0x60b3
 *   0358  3a 0d 60     ld   a,(0x600d)
 *   035b  a7           and  a
 *   035c  28 03        jr   z,0x0361
 *   035e  21 b6 60     ld   hl,0x60b6
 *   0361  7e           ld   a,(hl)           ; loc_0361
 *   0362  e6 f0        and  0xf0
 *   0364  47           ld   b,a
 *   0365  23           inc  hl
 *   0366  7e           ld   a,(hl)
 *   0367  e6 0f        and  0x0f
 *   0369  b0           or   b
 *   036a  0f           rrca
 *   036b  0f           rrca
 *   036c  0f           rrca
 *   036d  0f           rrca
 *   036e  21 21 60     ld   hl,0x6021
 *   0371  be           cp   (hl)
 *   0372  d8           ret  c
 *   0373  3e 01        ld   a,0x01
 *   0375  32 2d 62     ld   (0x622d),a
 *   0378  21 28 62     ld   hl,0x6228
 *   037b  34           inc  (hl)
 *   037c  c3 b8 06     jp   0x06b8
 *
 * Packs a BCD-ish score value out of two nibbles, rotates it down four bits,
 * and compares against the bonus threshold at 0x6021. On reaching it, sets
 * the "awarded" flag at 0x622D, bumps the life count at 0x6228, and TAIL
 * JUMPS to 0x06B8 -- it does not return there, so 0x06B8's `ret` returns to
 * loc_0350's caller.
 */
export function loc_0350(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x622d);
  m.step(0x0353, 13);
  regs.and(regs.a);
  m.step(0x0354, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x0355, 5);

  regs.hl = 0x60b3;
  m.step(0x0358, 10);
  regs.a = mem.read8(0x600d);
  m.step(0x035b, 13);
  regs.and(regs.a);
  m.step(0x035c, 4);
  if (regs.fZ) {
    m.step(0x0361, 12); // jr z taken
  } else {
    m.step(0x035e, 7);
    regs.hl = 0x60b6;
    m.step(0x0361, 10);
  }

  // loc_0361
  regs.a = mem.read8(regs.hl);
  m.step(0x0362, 7);
  regs.and(0xf0);
  m.step(0x0364, 7);
  regs.b = regs.a;
  m.step(0x0365, 4);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0366, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x0367, 7);
  regs.and(0x0f);
  m.step(0x0369, 7);
  regs.or(regs.b);
  m.step(0x036a, 4);
  const RRCA = [0x036b, 0x036c, 0x036d, 0x036e];
  for (let i = 0; i < 4; i++) {
    regs.rrca();
    m.step(RRCA[i], 4);
  }
  regs.hl = 0x6021;
  m.step(0x0371, 10);
  regs.cp(mem.read8(regs.hl));
  m.step(0x0372, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- below the threshold
    return;
  }
  m.step(0x0373, 5);

  regs.a = 0x01;
  m.step(0x0375, 7);
  mem.write8(0x622d, regs.a);
  m.step(0x0378, 13);
  regs.hl = 0x6228;
  m.step(0x037b, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x037c, 11);
  // jp 0x06b8 -- TAIL jump: no push, so 0x06B8's ret returns to OUR caller.
  // `return` propagates entry_06b8's answer instead of dropping it (hygiene --
  // it is constant TRUE now, so this is inert today; it stops a future reader
  // seeing a bare call at a tail and inferring the boolean does not matter).
  m.step(0x06b8, 10);
  return m.call(0x06b8);
}
