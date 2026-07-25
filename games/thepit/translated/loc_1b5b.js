// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b5b  (ROM 0x1b5b-0x1b77) — build the 4-byte record at 0x8220 from the
 * actor block at 0x8068-0x806b, biasing the ends by the value at 0x8051:
 *   0x8220 = mem[0x8068] - mem[0x8051]   (leading byte, bias subtracted)
 *   0x8221 = mem[0x8069]
 *   0x8222 = mem[0x806a]
 *   0x8223 = mem[0x806b] + mem[0x8051]   (trailing byte, bias added)
 * B holds the bias (0x8051) throughout and on exit; the final flags come from
 * the closing `add a,b`. Pure work-RAM shuffle — no calls.
 *
 *   1b5b  21 20 82     ld   hl,0x8220
 *   1b5e  3a 51 80     ld   a,(0x8051)
 *   1b61  47           ld   b,a
 *   1b62  3a 68 80     ld   a,(0x8068)
 *   1b65  90           sub  b
 *   1b66  77           ld   (hl),a
 *   1b67  23           inc  hl
 *   1b68  3a 69 80     ld   a,(0x8069)
 *   1b6b  77           ld   (hl),a
 *   1b6c  23           inc  hl
 *   1b6d  3a 6a 80     ld   a,(0x806a)
 *   1b70  77           ld   (hl),a
 *   1b71  23           inc  hl
 *   1b72  3a 6b 80     ld   a,(0x806b)
 *   1b75  80           add  a,b
 *   1b76  77           ld   (hl),a
 *   1b77  c9           ret
 */
export function loc_1b5b(m) {
  const { regs, mem } = m;
  regs.hl = 0x8220;
  m.step(0x1b5e, 10);
  regs.a = mem.read8(0x8051);
  m.step(0x1b61, 13);
  regs.b = regs.a;
  m.step(0x1b62, 4);
  regs.a = mem.read8(0x8068);
  m.step(0x1b65, 13);
  regs.sub(regs.b);
  m.step(0x1b66, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x1b67, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1b68, 6);
  regs.a = mem.read8(0x8069);
  m.step(0x1b6b, 13);
  mem.write8(regs.hl, regs.a);
  m.step(0x1b6c, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1b6d, 6);
  regs.a = mem.read8(0x806a);
  m.step(0x1b70, 13);
  mem.write8(regs.hl, regs.a);
  m.step(0x1b71, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1b72, 6);
  regs.a = mem.read8(0x806b);
  m.step(0x1b75, 13);
  regs.add(regs.b);
  m.step(0x1b76, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x1b77, 7);
  m.ret();
}
