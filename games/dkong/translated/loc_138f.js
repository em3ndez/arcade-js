// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_138f  (ROM 0x138F–0x13A0) — rst 0x18 gate; 0x600A:= 0x17 or 0x14 per 0x6048.
 *
 *   138f  df           rst  0x18
 *   1390  0e 17        ld   c,0x17
 *   1392  3a 48 60     ld   a,(0x6048)
 *   1395  34           inc  (hl)          ; loc_1395 -- re-arm 0x6009 (HL from sub_0018)
 *   1396  a7           and  a
 *   1397  c2 9c 13     jp   nz,0x139c     ; 0x6048 != 0 -> C stays 0x17
 *   139a  0e 14        ld   c,0x14        ; else C = 0x14 (falls through)
 *   139c  79           ld   a,c
 *   139d  32 0a 60     ld   (0x600a),a
 *   13a0  c9           ret
 */
export function loc_138f(m) {
  const { regs, mem } = m;

  m.push16(0x1390);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter did not expire -- dispatch abandoned

  regs.c = 0x17;
  m.step(0x1392, 7); // ld c,0x17
  regs.a = mem.read8(0x6048); // the source byte (0x6048 -- vs loc_13a1's)
  m.step(0x1395, 13); // ld a,(0x6048)

  // -- loc_1395: HL is 0x6009 (set by sub_0018), NOT by the caller --
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- re-arm 0 -> 1
  m.step(0x1396, 11);
  regs.and(regs.a); // tests the 0x6048 byte -- inc (hl) left A alone
  m.step(0x1397, 4);
  if (regs.fNZ) {
    m.step(0x139c, 10); // jp nz -- C stays 0x17
  } else {
    m.step(0x139a, 10); // jp nz NOT taken
    regs.c = 0x14; // C = 0x14, falls through into 0x139c
    m.step(0x139c, 7);
  }

  regs.a = regs.c;
  m.step(0x139d, 4); // ld a,c
  mem.write8(0x600a, regs.a); // 0x17 if 0x6048 was non-zero, else 0x14
  m.step(0x13a0, 13);
  m.ret(10); // ret (0x13A0)
}
