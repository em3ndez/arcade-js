// SPDX-License-Identifier: GPL-3.0-only

/** loc_0689  (ROM 0x0689–0x0690) — the shared tail of both loc_066a arms. */
export function loc_0689(m) {
  const { regs, mem } = m;

  mem.write8(0x74e6, regs.a); // 0x74E6 BEFORE 0x74C6 -- see loc_066a
  m.step(0x068c, 13); // ld (0x74e6),a
  regs.a = regs.b;
  m.step(0x068d, 4); // ld a,b
  mem.write8(0x74c6, regs.a);
  m.step(0x0690, 13); // ld (0x74c6),a

  m.ret(); // 0690
}
