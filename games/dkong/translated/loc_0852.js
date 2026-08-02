// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0852  (ROM 0x0852–0x0873) — two nested fills.
 *
 *   0852  21 00 74     ld   hl,0x7400
 *   0855  0e 04        ld   c,0x04
 *   0857  06 00        ld   b,0x00      ; B=0 means 256 iterations
 *   0859  3e 10        ld   a,0x10
 *   085b  77           ld   (hl),a
 *   085c  23           inc  hl
 *   085d  10 fc        djnz 0x085b
 *   085f  0d           dec  c
 *   0860  c2 57 08     jp   nz,0x0857   ; HL NOT reloaded -- the walk continues
 *   0863  21 00 69     ld   hl,0x6900
 *   0866  0e 02        ld   c,0x02
 *   0868  06 c0        ld   b,0xc0      ; 192, NOT 256
 *   086a  af           xor  a
 *   086b  77           ld   (hl),a
 *   086c  23           inc  hl
 *   086d  10 fc        djnz 0x086b
 *   086f  0d           dec  c
 *   0870  c2 68 08     jp   nz,0x0868
 *   0873  c9           ret
 */
export function loc_0852(m) {
  const { regs, mem } = m;

  regs.hl = 0x7400;
  m.step(0x0855, 10); // ld hl,0x7400
  regs.c = 0x04;
  m.step(0x0857, 7); // ld c,0x04

  do {
    // -- loc_0857 --
    regs.b = 0x00; // 256 iterations: djnz decrements FIRST
    m.step(0x0859, 7);
    regs.a = 0x10;
    m.step(0x085b, 7);
    do {
      // -- loc_085b --
      mem.write8(regs.hl, regs.a);
      m.step(0x085c, 7); // ld (hl),a
      regs.hl = (regs.hl + 1) & 0xffff; // 16-bit inc -- carries across pages
      m.step(0x085d, 6); // inc hl
      regs.djnz();
      m.step(regs.b !== 0 ? 0x085b : 0x085f, regs.b !== 0 ? 13 : 8); // djnz
    } while (regs.b !== 0);
    regs.c = regs.dec8(regs.c);
    m.step(0x0860, 4); // dec c
    m.step(regs.fNZ ? 0x0857 : 0x0863, 10); // jp nz,0x0857 -- HL NOT reloaded
  } while (regs.fNZ);

  regs.hl = 0x6900;
  m.step(0x0866, 10); // ld hl,0x6900
  regs.c = 0x02;
  m.step(0x0868, 7); // ld c,0x02

  do {
    // -- loc_0868 --
    regs.b = 0xc0; // 192 -- NOT 256
    m.step(0x086a, 7);
    regs.xor(regs.a); // A = 0, and clears flags (unlike ld a,n)
    m.step(0x086b, 4);
    do {
      // -- loc_086b --
      mem.write8(regs.hl, regs.a);
      m.step(0x086c, 7); // ld (hl),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x086d, 6); // inc hl
      regs.djnz();
      m.step(regs.b !== 0 ? 0x086b : 0x086f, regs.b !== 0 ? 13 : 8); // djnz
    } while (regs.b !== 0);
    regs.c = regs.dec8(regs.c);
    m.step(0x0870, 4); // dec c
    m.step(regs.fNZ ? 0x0868 : 0x0873, 10); // jp nz,0x0868
  } while (regs.fNZ);

  m.ret(); // ret (0x0873)
}
