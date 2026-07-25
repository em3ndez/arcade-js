// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a76  (ROM 0x0A76–0x0A79) — rst 0x28 dispatch on 0x6385, table at 0x0A7A.
 *
 *   0a76  3a 85 63     ld   a,(0x6385)
 *   0a79  ef           rst  0x28        ; -> table 0x0A7A-0x0A89, 8 entries
 */
export function loc_0a76(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6385);
  m.step(0x0a79, 13); // ld a,(0x6385)

  m.push16(0x0a7a); // rst 0x28 pushes its return address = the TABLE BASE (0x0A7A)
  m.step(0x0028, 11);
  m.call(0x0028, "0x0A7A (0x6385 sequence)"); // reads the table from ROM; ends in jp (hl)
}
