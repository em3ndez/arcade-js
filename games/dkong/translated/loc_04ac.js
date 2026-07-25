// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04ac  (ROM 0x04AC–0x04BD) — SHARED store of (0x6905) + the 3-way blink exit (jp target from 0x04EE, 0x0506).
 */
export function loc_04ac(m) {
  const { regs, mem } = m;
  mem.write8(0x6905, regs.a);
  m.step(0x04af, 13); // ld (0x6905),a
  regs.bit(6, regs.c);
  m.step(0x04b1, 8); // bit 6,c
  if (regs.fZ) { m.ret(11); return; } // ret z (EXIT-1)
  m.step(0x04b2, 5); // ret z NOT taken
  regs.b = regs.a;
  m.step(0x04b3, 4); // ld b,a
  regs.a = regs.c;
  m.step(0x04b4, 4); // ld a,c
  regs.and(0x07);
  m.step(0x04b6, 7); // and 0x07
  if (regs.fNZ) { m.ret(11); return; } // ret nz (EXIT-2)
  m.step(0x04b7, 5); // ret nz NOT taken
  regs.a = regs.b;
  m.step(0x04b8, 4); // ld a,b
  regs.xor(0x03);
  m.step(0x04ba, 7); // xor 0x03 -- flip bits 0,1 of (6905)
  mem.write8(0x6905, regs.a);
  m.step(0x04bd, 13); // ld (0x6905),a
  m.ret(10); // ret (EXIT-3)
}
