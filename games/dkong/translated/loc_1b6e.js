// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b6e  (ROM 0x1B6E–0x1BB1) — JUMP INIT.
 */
export function loc_1b6e(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1b70, 7); // ld a,0x01
  mem.write8(0x6216, regs.a);
  m.step(0x1b73, 13); // ld (0x6216),a
  regs.hl = 0x6210;
  m.step(0x1b76, 10); // ld hl,0x6210
  regs.a = mem.read8(0x6010);
  m.step(0x1b79, 13); // ld a,(0x6010)
  regs.bc = 0x0080; // +X velocity
  m.step(0x1b7c, 10); // ld bc,0x0080
  regs.rra(); // input bit 0 -> carry
  m.step(0x1b7d, 4); // rra
  if (regs.fC) { m.step(0x1b8a, 10); return m.call(0x1b8a); } // jp c
  m.step(0x1b80, 10);
  regs.bc = 0xff80; // -X velocity
  m.step(0x1b83, 10); // ld bc,0xff80
  regs.rra(); // input bit 1 -> carry
  m.step(0x1b84, 4); // rra
  if (regs.fC) { m.step(0x1b8a, 10); return m.call(0x1b8a); } // jp c
  m.step(0x1b87, 10);
  regs.bc = 0x0000;
  m.step(0x1b8a, 10); // ld bc,0x0000
  return m.call(0x1b8a);
}
