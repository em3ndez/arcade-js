// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_127f  (ROM 0x127F–0x128A) — rst 0x28 dispatch on 0x639D, table at 0x1283.
 *
 *   127f  3a 9d 63     ld   a,(0x639d)
 *   1282  ef           rst  0x28        ; -> table 0x1283: 0x128B 0x12AC 0x12DE 0x0000
 */
export function entry_127f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x639d);
  m.step(0x1282, 13); // ld a,(0x639d)

  m.push16(0x1283); // rst 0x28 pushes its return address = the TABLE BASE (0x1283)
  m.step(0x0028, 11);
  m.call(0x0028, "0x1283 (0x639D dispatch)"); // reads the table from ROM; ends in jp (hl)
}
