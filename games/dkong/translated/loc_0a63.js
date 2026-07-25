// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a63  (ROM 0x0A63–0x0A75) — rst 0x18 gate; re-arm and advance 0x600A by 1 or 2.
 *
 *   0a63  df           rst  0x18
 *   0a64  cd 74 08     call 0x0874
 *   0a67  21 09 60     ld   hl,0x6009
 *   0a6a  36 01        ld   (hl),0x01     ; re-arm the countdown to 1
 *   0a6c  2c           inc  l             ; HL = 0x600A
 *   0a6d  34           inc  (hl)          ; 0x600A += 1
 *   0a6e  11 2c 62     ld   de,0x622c
 *   0a71  1a           ld   a,(de)
 *   0a72  a7           and  a             ; Z iff 0x622C == 0
 *   0a73  c0           ret  nz            ; != 0 -> advance stays +1
 *   0a74  34           inc  (hl)          ; == 0 -> 0x600A += 2 total
 *   0a75  c9           ret
 */
export function loc_0a63(m) {
  const { regs, mem } = m;

  m.push16(0x0a64); // rst 0x18 pushes its return address
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter still ticking -- skipped to our caller

  m.push16(0x0a67);
  m.step(0x0874, 17); // call 0x0874
  m.call(0x0874);

  regs.hl = 0x6009;
  m.step(0x0a6a, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0x01); // re-arm to 1 (absolute)
  m.step(0x0a6c, 10); // ld (hl),0x01
  regs.l = regs.inc8(regs.l); // inc l -- 8-bit; HL = 0x600A
  m.step(0x0a6d, 4);
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x600A += 1
  m.step(0x0a6e, 11);

  regs.de = 0x622c;
  m.step(0x0a71, 10); // ld de,0x622c
  regs.a = mem.read8(regs.de);
  m.step(0x0a72, 7); // ld a,(de)
  regs.and(regs.a); // and a -- Z iff 0x622C == 0
  m.step(0x0a73, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- 0x622C != 0, advance stays +1
    return;
  }
  m.step(0x0a74, 5); // ret nz NOT taken

  regs.incMem8(mem, regs.hl); // inc (hl) AGAIN -- 0x600A += 2 total
  m.step(0x0a75, 11);
  m.ret(); // ret (0x0A75)
}
