// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_05da  (ROM 0x05DA–0x05DF) — the last two instructions of handler_05c6
 *
 *   05da  11 ba 60     ld   de,0x60ba
 *   05dd  c3 78 05     jp   0x0578
 *
 * A THIRD ENTRY POINT, extracted because entry_051c TAIL-JUMPS here from
 * 0x055C. It is not a routine in the ROM -- it is the fall-through tail of
 * handler_05c6, and 0x051C reaches the same two instructions by `jp 0x05da`.
 *
 * Extracted rather than duplicated: two copies of a two-instruction tail is
 * exactly where a later edit fixes one and not the other. The caller performs
 * the step that LANDS on 0x05DA, because its cost differs by route -- 10 T for
 * handler_05c6's not-taken `jp nz`, 10 T for 0x055C's unconditional `jp`.
 */
export function loc_05da(m) {
  const { regs } = m;

  regs.de = 0x60ba;
  m.step(0x05dd, 10); // ld de,0x60ba
  m.step(0x0578, 10); // jp 0x0578 -- tail jump, nothing pushed
  return m.call(0x0578);
}
