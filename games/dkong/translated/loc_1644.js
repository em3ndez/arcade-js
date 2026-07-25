// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1644  (ROM 0x1644–0x1647) — rst 0x28 dispatch on 0x6388 (table 0x1648, 6 entries).
 */
export function loc_1644(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6388);
  m.step(0x1647, 13); // ld a,(0x6388)
  m.push16(0x1648); // rst 0x28 pushes the table base
  m.step(0x0028, 11);
  m.call(0x0028, "0x1648 (0x6388 sequence)"); // reads the ROM table; ends in jp (hl)
}
