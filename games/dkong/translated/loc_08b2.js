// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_08b2  (ROM 0x08B2–0x08B5) — rst 0x28 dispatch on 0x600A, table at 0x08B6.
 *
 *   08b2  3a 0a 60     ld   a,(0x600a)
 *   08b5  ef           rst  0x28        ; -> table 0x08B6-0x08B9, only TWO entries
 */
export function loc_08b2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x600a);
  m.step(0x08b5, 13); // ld a,(0x600a)

  m.push16(0x08b6); // rst 0x28 pushes its return address = the TABLE BASE (0x08B6, NOT 0x0702)
  m.step(0x0028, 11);
  m.call(0x0028, "0x08B6 (0x600A, 2-entry)"); // reads the table from ROM; ends in jp (hl)
}
