// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_22f6  (ROM 0x22F6–0x22F6) — the RNG velocity (difficulty 1/2): A = (0x6018); falls into loc_22f9.
 */
export function loc_22f6(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6018); // RNG
  m.step(0x22f9, 13); // ld a,(0x6018)
  return m.call(0x22f9);
}
