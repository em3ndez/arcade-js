// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_286f  (ROM 0x286F–0x2873).
 */
export function sub_286f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6227);
  m.step(0x2872, 13); // ld a,(0x6227)
  m.push16(regs.hl); // push hl -- survives to the target's pop hl
  m.step(0x2873, 11);

  m.push16(0x2874); // rst 0x28 pushes its return address = the TABLE BASE (0x2874)
  m.step(0x0028, 11);
  m.call(0x0028, "0x2874 (0x6227 collision dispatch)"); // reads the table from ROM; ends in jp (hl)
}
