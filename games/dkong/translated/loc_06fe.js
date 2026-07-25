// SPDX-License-Identifier: GPL-3.0-only

/** loc_06fe's inline jump table -- the site string names the dispatch base. */
const DISPATCH_TABLE_0702 = "0x0702 (0x600A game sub-state)";

/**
 * loc_06fe  (ROM 0x06FE–0x0701) — rst 0x28 dispatch on 0x600A, table at 0x0702.
 *
 *   06fe  3a 0a 60     ld   a,(0x600a)
 *   0701  ef           rst  0x28        ; -> table 0x0702-0x073B, 29 entries
 *
 * SIX ENTRIES ARE 0x0000 (idx 9, 24-28) and A is unchecked (no range check) --
 * a null or out-of-range selector dispatches to 0x0000 / off the table. The ROM
 * has no guard; dispatchGameState surfaces an unimplemented/null target as a
 * loud throw rather than a silent reset.
 */
export function loc_06fe(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x600a);
  m.step(0x0701, 13); // ld a,(0x600a)

  m.push16(0x0702); // rst 0x28 pushes its return address = the TABLE BASE
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_0702); // reads the table from ROM; ends in jp (hl)
}
