// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fbe  (ROM 0x2FBE–0x2FC8) — (0x601A) bit3 gate: clear -> loc_2f7c; set -> C=0x01 -> loc_2f7c.
 */
export function loc_2fbe(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x2fc1, 13); // ld a,(0x601a)
  regs.bit(3, regs.a);
  m.step(0x2fc3, 8); // bit 3,a
  if (regs.fZ) { m.step(0x2f7c, 10); return m.call(0x2f7c); } // jp z,0x2f7c
  m.step(0x2fc6, 10);
  regs.c = 0x01;
  m.step(0x2fc8, 7); // ld c,0x01
  m.step(0x2f7c, 10); // jp 0x2f7c
  return m.call(0x2f7c);
}
