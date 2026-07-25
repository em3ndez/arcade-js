// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_28b0  (ROM 0x28B0–0x28DF) — three entry_2913 sweeps; rst 0x28 tail target.
 *
 *   28b0  e1           pop  hl                 ; recover the dispatcher's HL
 *   28b1  06 05        ld   b,0x05
 *   28b3  78           ld   a,b
 *   28b4  32 b9 63     ld   (0x63b9),a
 *   28b7  11 20 00     ld   de,0x0020
 *   28ba  dd 21 00 64  ld   ix,0x6400
 *   28be  cd 13 29     call 0x2913            ; GUARDED
 *   28c1  06 06        ld   b,0x06 ...         ; group 2: ld e,0x10 (D survives), ix=0x65a0
 *   28cd  cd 13 29     call 0x2913            ; GUARDED
 *   28d0  06 01        ld   b,0x01 ...         ; group 3: ld e,0x00 (stride 0), ix=0x66a0
 *   28dc  cd 13 29     call 0x2913            ; GUARDED
 *   28df  c9           ret
 */
export function sub_28b0(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); // pop hl -- the dispatcher's pushed HL (2913's axis-2 bounds)
  m.step(0x28b1, 10);

  // group 1: B=5, DE=0x0020, IX=0x6400
  regs.b = 0x05;
  m.step(0x28b3, 7); // ld b,0x05
  regs.a = regs.b;
  m.step(0x28b4, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28b7, 13); // ld (0x63b9),a
  regs.de = 0x0020;
  m.step(0x28ba, 10); // ld de,0x0020
  regs.ix = 0x6400;
  m.step(0x28be, 14); // ld ix,0x6400
  m.push16(0x28c1); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true; // 2913 HIT skipped us -> our caller resumes

  // group 2: B=6, E=0x10 (D preserved = 0x00), IX=0x65a0
  regs.b = 0x06;
  m.step(0x28c3, 7); // ld b,0x06
  regs.a = regs.b;
  m.step(0x28c4, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28c7, 13); // ld (0x63b9),a
  regs.e = 0x10;
  m.step(0x28c9, 7); // ld e,0x10 -- E only; D stays 0x00 across the calls
  regs.ix = 0x65a0;
  m.step(0x28cd, 14); // ld ix,0x65a0
  m.push16(0x28d0); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true;

  // group 3: B=1, E=0x00 (stride 0x0000), IX=0x66a0
  regs.b = 0x01;
  m.step(0x28d2, 7); // ld b,0x01
  regs.a = regs.b;
  m.step(0x28d3, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28d6, 13); // ld (0x63b9),a
  regs.e = 0x00;
  m.step(0x28d8, 7); // ld e,0x00 -- stride 0
  regs.ix = 0x66a0;
  m.step(0x28dc, 14); // ld ix,0x66a0
  m.push16(0x28df); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true;

  m.ret(); // ret (0x28DF)
  return true; // all sweeps completed normally -> caller continues
}
