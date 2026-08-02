// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2acd  (ROM 0x2ACD–0x2AD2) — set slope-contact flag 0x6221 = 1, ret.
 */
export function loc_2acd(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x2acf, 7); // ld a,0x01
  mem.write8(0x6221, regs.a);
  m.step(0x2ad2, 13); // ld (0x6221),a
  m.ret(); // 0x2AD2 c9 ret
}
