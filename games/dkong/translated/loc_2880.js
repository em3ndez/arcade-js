// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2880  (ROM 0x2880–0x28AC).
 */
export function loc_2880(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); // pop hl -- recover sub_286f's pushed HL (balances the stack)
  m.step(0x2881, 10);

  // -- sweep 1: 0x6700, count 0x0A, stride 0x0020 --
  regs.b = 0x0a;
  m.step(0x2883, 7); // ld b,0x0a
  regs.a = regs.b;
  m.step(0x2884, 4); // ld a,b
  mem.write8(0x63b9, regs.a); // 0x63B9 = count
  m.step(0x2887, 13);
  regs.de = 0x0020; // D=0x00 LIVE across the next two calls
  m.step(0x288a, 10); // ld de,0x0020
  regs.ix = 0x6700;
  m.step(0x288e, 14); // ld ix,0x6700
  m.push16(0x2891);
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return false; // HIT: 2913 unwound to sub_2808 w/ A=1 -- STOP (preserves D)

  // -- sweep 2: 0x6400, count 0x05 (only E reloaded; D stays 0x00) --
  regs.b = 0x05;
  m.step(0x2893, 7); // ld b,0x05
  regs.a = regs.b;
  m.step(0x2894, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x2897, 13);
  regs.e = 0x20; // E only -- DE = 0x0020
  m.step(0x2899, 7); // ld e,0x20
  regs.ix = 0x6400;
  m.step(0x289d, 14); // ld ix,0x6400
  m.push16(0x28a0);
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return false; // HIT: caller-skip already unwound to sub_2808 -- STOP

  // -- sweep 3: 0x66A0, count 0x01, stride 0x0000 (E=0, D stays 0x00) --
  regs.b = 0x01;
  m.step(0x28a2, 7); // ld b,0x01
  regs.a = regs.b;
  m.step(0x28a3, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28a6, 13);
  regs.e = 0x00; // E only -- DE = 0x0000
  m.step(0x28a8, 7); // ld e,0x00
  regs.ix = 0x66a0;
  m.step(0x28ac, 14); // ld ix,0x66a0
  m.push16(0x28af);
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return false; // HIT: caller-skip already unwound to sub_2808 -- STOP

  m.ret(); // ret (0x28AF) -- all sweeps missed
}
