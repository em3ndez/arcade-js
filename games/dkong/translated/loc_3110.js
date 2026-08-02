// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3110  (ROM 0x3110–0x311A) — THE 0x3110 GUARD FAMILY -- four rst-0x28 dispatch targets, 11 bytes each.
 * ROM 0x3110-0x313B. Reached from entry_30fa's inline jump table.
 *
 * All four share ONE shape and differ in THREE places. Written from their own
 * bytes individually; the table is the differencing record, not a template:
 *
 *   addr    reads    mask   cp    cond     returns NORMALLY when
 *   3110    0x601a   & 1    0x01  ret z    (0x601a & 1) == 1   -- bit 0 SET
 *   311b    0x601a   & 7    0x05  ret m    (0x601a & 7) <  5
 *   3126    0x601a   & 3    0x03  ret m    (0x601a & 3) <  3
 *   3131    0x601a   & 7    0x07  ret m    (0x601a & 7) <  7
 *
 *   3110  3a 1a 60 / e6 01 / fe 01 / c8 / 33 / 33 / c9
 *   311b  3a 1a 60 / e6 07 / fe 05 / f8 / 33 / 33 / c9
 *   3126  3a 1a 60 / e6 03 / fe 03 / f8 / 33 / 33 / c9
 *   3131  3a 1a 60 / e6 07 / fe 07 / f8 / 33 / 33 / c9
 *
 * THE POLARITY TRAP IS LIVE HERE. 0x3110 uses `ret z` (0xC8) -- an EQUALITY
 * test; the other three use `ret m` (0xF8) -- the SIGN flag. They are one
 * opcode apart and mean different things, and the masks and compares differ
 * too. Copying any one of these onto another is silently wrong, and the
 * write-gate cannot see it (work RAM only). At 0x601a = 0x00, ONLY 0x3110
 * splices; at 0x601a = 0x07, ONLY 0x3110 returns normally -- the family is
 * genuinely inverted at both ends of its range.
 *
 * `ret m` reads the SIGN of (A - n). After `and`, A is 0..7 and n is 3..7, so
 * A-n cannot overflow and the sign is exactly "A < n" -- but it is the sign
 * flag, NOT carry, and is not interchangeable with `ret c` in general.
 *
 * EVERY ONE IS A CALLER-SKIP: on the non-returning path they `inc sp / inc sp /
 * ret`, discarding their own return address so control lands in their caller's
 * CALLER. Each returns a boolean under the settled convention (sub_0008,
 * mainloop.js:172-183): true = the caller was returned to normally, false = the
 * caller is skipped and must `return` immediately.
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: reached only through entry_30fa's rst 0x28
 * table, which is untranslated. 0x601a is not interpreted.
 */
export function loc_3110(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x3113, 13); // ld a,(0x601a)
  regs.and(0x01);
  m.step(0x3115, 7); // and 0x01
  regs.cp(0x01);
  m.step(0x3117, 7); // cp 0x01
  if (regs.fZ) {
    m.ret(11); // ret z -- EQUALITY, not sign
    return true;
  }
  m.step(0x3118, 5); // ret z NOT taken
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x3119, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x311a, 6); // inc sp
  m.ret(); // 311a -- to the caller's CALLER
  return false;
}
