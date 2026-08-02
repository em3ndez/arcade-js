// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_128b  (ROM 0x128B–0x12AB).
 */
export function loc_128b(m) {
  const { regs, mem } = m;

  m.push16(0x128c);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // (0x6009) not expired -> body skipped

  regs.hl = 0x694d;
  m.step(0x128f, 10); // ld hl,0x694d
  regs.a = 0xf0;
  m.step(0x1291, 7); // ld a,0xf0
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl))); // rl (hl) -- C <- old bit7
  m.step(0x1293, 15);
  regs.rra(); // A = 0xF0>>1 | (C<<7)
  m.step(0x1294, 4);
  mem.write8(regs.hl, regs.a); // (0x694D) := 0x78/0xF8
  m.step(0x1295, 7);
  regs.hl = 0x639d;
  m.step(0x1298, 10); // ld hl,0x639d
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- advance the state
  m.step(0x1299, 11);
  regs.a = 0x0d;
  m.step(0x129b, 7); // ld a,0x0d
  mem.write8(0x639e, regs.a); // 0x639E := 0x0D
  m.step(0x129e, 13);
  regs.a = 0x08;
  m.step(0x12a0, 7); // ld a,0x08
  mem.write8(0x6009, regs.a); // re-arm the rst 0x18 timer
  m.step(0x12a3, 13);
  m.push16(0x12a6);
  m.step(0x30bd, 17); // call 0x30bd
  m.call(0x30bd);
  regs.a = 0x03;
  m.step(0x12a8, 7); // ld a,0x03
  mem.write8(0x6088, regs.a); // 0x6088 := 3
  m.step(0x12ab, 13);
  m.ret(10); // ret (0x12AB)
}
