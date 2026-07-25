// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f09  (ROM 0x1F09–0x1F22) — / loc_1f1d -- (sub_1e96 dispatch target, index 1).
 *
 *   1f09  21 46 63     ld   hl,0x6346
 *   1f0c  35           dec  (hl)          ; every-6th-call delay
 *   1f0d  c0           ret  nz
 *   1f0e  36 06        ld   (hl),0x06     ; reload 0x6346
 *   1f10  2c           inc  l             ; HL -> 0x6347
 *   1f11  35           dec  (hl)
 *   1f12  ca 1d 1f     jp   z,0x1f1d
 *   1f15  21 2d 6a     ld   hl,0x6a2d
 *   1f18  7e           ld   a,(hl)
 *   1f19  ee 01        xor  0x01          ; toggle bit 0 of 0x6a2d
 *   1f1b  77           ld   (hl),a
 *   1f1c  c9           ret
 *   1f1d  36 04        ld   (hl),0x04     ; loc_1f1d: reload 0x6347 (HL=0x6347)
 *   1f1f  2d           dec  l             ; HL -> 0x6346
 *   1f20  2d           dec  l             ; HL -> 0x6345
 *   1f21  34           inc  (hl)          ; 0x6345: 1 -> 2 (advance the dispatch)
 *   1f22  c9           ret
 */
export function loc_1f09(m) {
  const { regs, mem } = m;

  regs.hl = 0x6346;
  m.step(0x1f0c, 10); // ld hl,0x6346
  regs.decMem8(mem, regs.hl); // dec (0x6346) -- flag-correct; ret nz reads its Z
  m.step(0x1f0d, 11); // dec (hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz TAKEN -- the delay, 11 T (draft TEST 1)
    return;
  }
  m.step(0x1f0e, 5); // ret nz NOT taken, 5 T

  mem.write8(regs.hl, 0x06); // reload 0x6346 = 6
  m.step(0x1f10, 10); // ld (hl),0x06
  regs.l = regs.inc8(regs.l); // inc l -- HL -> 0x6347
  m.step(0x1f11, 4);
  regs.decMem8(mem, regs.hl); // dec (0x6347) -- flag-correct; jp z reads its Z
  m.step(0x1f12, 11); // dec (hl)
  if (regs.fZ) {
    m.step(0x1f1d, 10); // jp z,0x1f1d taken -> loc_1f1d
    // loc_1f1d: reload 0x6347, walk HL to 0x6345, advance it 1 -> 2
    mem.write8(regs.hl, 0x04); // ld (hl),0x04 -- reload 0x6347 (HL=0x6347)
    m.step(0x1f1f, 10);
    regs.l = regs.dec8(regs.l); // dec l -- HL -> 0x6346
    m.step(0x1f20, 4);
    regs.l = regs.dec8(regs.l); // dec l -- HL -> 0x6345
    m.step(0x1f21, 4);
    regs.incMem8(mem, regs.hl); // inc (0x6345) -- 1 -> 2 (draft TEST 2)
    m.step(0x1f22, 11); // inc (hl)
    m.ret(); // ret (0x1F22)
    return;
  }
  m.step(0x1f15, 10); // jp z NOT taken

  regs.hl = 0x6a2d;
  m.step(0x1f18, 10); // ld hl,0x6a2d
  regs.a = mem.read8(regs.hl);
  m.step(0x1f19, 7); // ld a,(hl)
  regs.xor(0x01); // xor 0x01 -- toggle bit 0 (draft TEST 3: xor, NOT inc)
  m.step(0x1f1b, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x1f1c, 7); // ld (hl),a
  m.ret(); // ret (0x1F1C)
}
