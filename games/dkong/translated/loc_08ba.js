// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_08ba  (ROM 0x08BA–0x08D4) — 0x08B2 table arm 0; falls through to loc_08d5.
 *
 *   08ba  cd 74 08     call 0x0874        ; init/fill (no register input)
 *   08bd  af           xor  a
 *   08be  32 07 60     ld   (0x6007),a
 *   08c1  11 0c 03     ld   de,0x030c
 *   08c4  cd 9f 30     call 0x309f
 *   08c7  21 0a 60     ld   hl,0x600a
 *   08ca  34           inc  (hl)          ; advance the selector
 *   08cb  cd 65 09     call 0x0965        ; sees the ALREADY-incremented 0x600A
 *   08ce  af           xor  a
 *   08cf  21 86 7d     ld   hl,0x7d86
 *   08d2  77           ld   (hl),a        ; 0x7D86 = 0
 *   08d3  2c           inc  l
 *   08d4  77           ld   (hl),a        ; 0x7D87 = 0 (NOT 1 -- cf. loc_0c92)
 *   -- falls through into loc_08d5 --
 */
export function loc_08ba(m) {
  const { regs, mem } = m;

  m.push16(0x08bd); // call 0x0874
  m.step(0x0874, 17);
  m.call(0x0874);

  regs.xor(regs.a); // xor a -- A = 0
  m.step(0x08be, 4);
  mem.write8(0x6007, regs.a);
  m.step(0x08c1, 13); // ld (0x6007),a

  regs.de = 0x030c;
  m.step(0x08c4, 10); // ld de,0x030c
  m.push16(0x08c7); // call 0x309f -- DE=0x030C is a parameter
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.hl = 0x600a;
  m.step(0x08ca, 10); // ld hl,0x600a
  regs.incMem8(mem, regs.hl); // inc (hl) -- advances the selector
  m.step(0x08cb, 11);

  m.push16(0x08ce); // call 0x0965 -- sees the already-incremented 0x600A
  m.step(0x0965, 17);
  m.call(0x0965);

  regs.xor(regs.a); // xor a -- A = 0
  m.step(0x08cf, 4);
  regs.hl = 0x7d86;
  m.step(0x08d2, 10); // ld hl,0x7d86
  mem.write8(regs.hl, regs.a, 7); // 0x7D86 = 0
  m.step(0x08d3, 7); // ld (hl),a
  regs.l = regs.inc8(regs.l); // inc l -- 8-bit, no carry into H
  m.step(0x08d4, 4);
  mem.write8(regs.hl, regs.a, 7); // 0x7D87 = 0
  m.step(0x08d5, 7); // ld (hl),a

  return m.call(0x08d5); // fall through -- loc_08d5's ret returns for both. NO push16.
}
