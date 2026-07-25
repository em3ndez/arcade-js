// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b45  (ROM 0x1B45–0x1B4D) — input bit2 -> 0x1d03 (external); else ret.
 */
export function loc_1b45(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6010);
  m.step(0x1b48, 13); // ld a,(0x6010)
  regs.bit(2, regs.a);
  m.step(0x1b4a, 8); // bit 2,a
  if (regs.fNZ) { m.step(0x1d03, 10); return m.call(0x1d03); } // jp nz -- external
  m.step(0x1b4d, 10);
  m.ret(10);
}
