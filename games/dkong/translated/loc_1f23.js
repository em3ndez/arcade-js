// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f23  (ROM 0x1F23–0x1F45) — / loc_1f34 -- (sub_1e96 dispatch target, index 2).
 *
 *   1f23  21 46 63     ld   hl,0x6346
 *   1f26  35           dec  (hl)          ; every-Nth-call delay
 *   1f27  c0           ret  nz
 *   1f28  36 0c        ld   (hl),0x0c     ; reload 0x6346 (TWIN: 0x0c vs 0x06)
 *   1f2a  2c           inc  l             ; HL -> 0x6347
 *   1f2b  35           dec  (hl)
 *   1f2c  ca 34 1f     jp   z,0x1f34
 *   1f2f  21 2d 6a     ld   hl,0x6a2d
 *   1f32  34           inc  (hl)          ; TWIN: inc vs xor 0x01
 *   1f33  c9           ret
 *   1f34  2d           dec  l             ; loc_1f34: HL 0x6347 -> 0x6346
 *   1f35  2d           dec  l             ; HL -> 0x6345
 *   1f36  af           xor  a             ; A = 0
 *   1f37  77           ld   (hl),a        ; 0x6345 = 0 -- RESET the index (bounds)
 *   1f38  32 50 63     ld   (0x6350),a    ; 0x6350 = 0
 *   1f3b  3c           inc  a             ; A = 1
 *   1f3c  32 40 63     ld   (0x6340),a    ; game state 0x6340 = 1
 *   1f3f  21 2c 6a     ld   hl,0x6a2c
 *   1f42  22 43 63     ld   (0x6343),hl   ; 0x6343 = 0x6a2c (loc_1e15's pointer)
 *   1f45  c9           ret
 */
export function loc_1f23(m) {
  const { regs, mem } = m;

  regs.hl = 0x6346;
  m.step(0x1f26, 10); // ld hl,0x6346
  regs.decMem8(mem, regs.hl); // dec (0x6346) -- flag-correct; ret nz reads its Z
  m.step(0x1f27, 11); // dec (hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz TAKEN -- the delay, 11 T
    return;
  }
  m.step(0x1f28, 5); // ret nz NOT taken, 5 T

  mem.write8(regs.hl, 0x0c); // reload 0x6346 = 0x0c (TWIN differs from loc_1f09's 0x06)
  m.step(0x1f2a, 10); // ld (hl),0x0c
  regs.l = regs.inc8(regs.l); // inc l -- HL -> 0x6347
  m.step(0x1f2b, 4);
  regs.decMem8(mem, regs.hl); // dec (0x6347) -- flag-correct; jp z reads its Z
  m.step(0x1f2c, 11); // dec (hl)
  if (regs.fZ) {
    m.step(0x1f34, 10); // jp z,0x1f34 taken -> loc_1f34
    // loc_1f34: reset the dispatch index and seed the next stage.
    regs.l = regs.dec8(regs.l); // dec l -- HL -> 0x6346
    m.step(0x1f35, 4);
    regs.l = regs.dec8(regs.l); // dec l -- HL -> 0x6345
    m.step(0x1f36, 4);
    regs.xor(regs.a); // xor a -- A = 0
    m.step(0x1f37, 4);
    mem.write8(regs.hl, regs.a); // ld (hl),a -- 0x6345 = 0 (RESET the 1e96 index)
    m.step(0x1f38, 7);
    mem.write8(0x6350, regs.a); // ld (0x6350),a -- 0x6350 = 0
    m.step(0x1f3b, 13);
    regs.a = regs.inc8(regs.a); // inc a -- A = 1
    m.step(0x1f3c, 4);
    mem.write8(0x6340, regs.a); // ld (0x6340),a -- game state 0x6340 = 1
    m.step(0x1f3f, 13);
    regs.hl = 0x6a2c;
    m.step(0x1f42, 10); // ld hl,0x6a2c
    mem.write16(0x6343, regs.hl); // ld (0x6343),hl -- 0x6343 = 0x6a2c
    m.step(0x1f45, 16);
    m.ret(); // ret (0x1F45)
    return;
  }
  m.step(0x1f2f, 10); // jp z NOT taken

  regs.hl = 0x6a2d;
  m.step(0x1f32, 10); // ld hl,0x6a2d
  regs.incMem8(mem, regs.hl); // inc (0x6a2d) (TWIN: inc, vs loc_1f09's xor 0x01)
  m.step(0x1f33, 11); // inc (hl)
  m.ret(); // ret (0x1F33)
}
