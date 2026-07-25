// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b38  (ROM 0x1B38–0x1B4D) — input bit3 -> jump-phase; bit2 -> 0x1d03; else ret.
 */
export function loc_1b38(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6010);
  m.step(0x1b3b, 13); // ld a,(0x6010)
  regs.bit(3, regs.a);
  m.step(0x1b3d, 8); // bit 3,a
  if (regs.fNZ) { m.step(0x1cf2, 10); return m.call(0x1cf2); } // jp nz,0x1cf2
  m.step(0x1b40, 10);
  regs.a = mem.read8(0x6215);
  m.step(0x1b43, 13); // ld a,(0x6215)
  regs.and(regs.a);
  m.step(0x1b44, 4); // and a
  if (regs.fZ) { m.ret(11); return; } // ret z
  m.step(0x1b45, 5);
  return m.call(0x1b45);
}
