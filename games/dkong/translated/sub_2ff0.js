// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2ff0  (ROM 0x2FF0–0x3008) — (y,x) -> video RAM address.
 *
 *   2ff0  7d           ld   a,l
 *   2ff1  0f           rrca
 *   2ff2  0f           rrca
 *   2ff3  0f           rrca
 *   2ff4  e6 1f        and  0x1f
 *   2ff6  6f           ld   l,a
 *   2ff7  7c           ld   a,h
 *   2ff8  2f           cpl
 *   2ff9  e6 f8        and  0xf8
 *   2ffb  5f           ld   e,a
 *   2ffc  af           xor  a
 *   2ffd  67           ld   h,a
 *   2ffe  cb 13        rl   e
 *   3000  17           rla
 *   3001  cb 13        rl   e
 *   3003  17           rla
 *   3004  c6 74        add  a,0x74
 *   3006  57           ld   d,a
 *   3007  19           add  hl,de
 *   3008  c9           ret
 *
 * Takes H = y, L = x in PIXELS and returns HL = the video RAM address of the
 * tile containing that pixel. Computed as
 *
 *     col = (x >> 3) & 0x1f
 *     row = (255 - y) >> 3          <- note the complement
 *     HL  = 0x7400 + row * 32 + col
 *
 * THE `cpl` IS THE INTERESTING PART: the ROM complements Y before dividing
 * by 8, so its own address arithmetic is VERTICALLY MIRRORED. The 180-degree
 * rotation we render is not something MAME imposes on top of a
 * conventionally-addressed tilemap -- the game computes flipped addresses
 * itself, and our `renderRowRGB` flip is reproducing a transform the ROM
 * already assumes. Two independent expressions of the same geometry.
 *
 * The THREE `rrca` + `and 0x1f` is a divide-by-8 done as a ROTATE, so the low
 * three bits of x wrap into the top of A and are then masked off -- which is
 * why the mask is 0x1F and not 0x3F. (This said "four" while the note below
 * recorded that emitting four was the bug being fixed. The stale count
 * survived in the prose directly above its own correction, in the one place
 * a reader would go to check it.)
 *
 * `rl e / rla` twice is a 16-BIT LEFT SHIFT by two: each pair shifts E left
 * and catches the bit falling out of it in A. That turns (255-y)&0xF8, which
 * is row*8, into row*32 spread across A:E. `add a,0x74` then makes A the
 * page byte, so DE is the row offset from 0x7400 and HL = DE + col.
 *
 * NOTE `rl e` is CB-prefixed and sets the FULL flag set including Z and
 * parity, unlike the `rla` interleaved with it which preserves S/Z/PV. They
 * look like the same instruction and are not.
 */
export function sub_2ff0(m) {
  const { regs } = m;

  // Transcribed one instruction at a time against the listing. A first
  // version used a loop for the rrca run and emitted FOUR rotations where the
  // ROM has THREE (0x2FF1-0x2FF3), shifting every address after it. The
  // suite stayed green because nothing reaches this routine yet -- a latent
  // bug behind a passing test, which is exactly what a loop over an
  // instruction run buys you for the two lines it saves.
  regs.a = regs.l;
  m.step(0x2ff1, 4);
  regs.rrca();
  m.step(0x2ff2, 4);
  regs.rrca();
  m.step(0x2ff3, 4);
  regs.rrca();
  m.step(0x2ff4, 4);
  regs.and(0x1f);
  m.step(0x2ff6, 7);
  regs.l = regs.a;
  m.step(0x2ff7, 4);

  regs.a = regs.h;
  m.step(0x2ff8, 4);
  regs.cpl();
  m.step(0x2ff9, 4);
  regs.and(0xf8);
  m.step(0x2ffb, 7);
  regs.e = regs.a;
  m.step(0x2ffc, 4);
  regs.xor(regs.a);
  m.step(0x2ffd, 4);
  regs.h = regs.a;
  m.step(0x2ffe, 4);

  // The 16-bit left shift, twice. `rl e` is CB-prefixed at 8 T; `rla` is 4.
  regs.e = regs.rl(regs.e);
  m.step(0x3000, 8);
  regs.rla();
  m.step(0x3001, 4);
  regs.e = regs.rl(regs.e);
  m.step(0x3003, 8);
  regs.rla();
  m.step(0x3004, 4);

  regs.add(0x74);
  m.step(0x3006, 7);
  regs.d = regs.a;
  m.step(0x3007, 4);
  regs.addHl(regs.de);
  m.step(0x3008, 11);
  m.ret();
}
