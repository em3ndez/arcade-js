// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0763  (ROM 0x0763–0x0778) — 0x0748 table, game state 1 sub-state.
 *
 *   0763  e7           rst  0x20
 *   0764  af           xor  a
 *   0765  32 92 63     ld   (0x6392),a
 *   0768  32 a0 63     ld   (0x63a0),a
 *   076b  3e 01        ld   a,0x01
 *   076d  32 27 62     ld   (0x6227),a
 *   0770  32 29 62     ld   (0x6229),a
 *   0773  32 28 62     ld   (0x6228),a
 *   0776  c3 92 0c     jp   0x0c92
 *
 * Gated on `rst 0x20`, so the body runs only when both prescalers expire --
 * this is the timed advance out of the sub-state, not a per-frame action.
 *
 * Ends in a TAIL JUMP to 0x0C92, so 0x0C92's `ret` returns to this handler's
 * caller and this handler has no `ret` of its own.
 */
export function loc_0763(m) {
  const { regs, mem } = m;

  m.push16(0x0764);
  m.step(0x0020, 11); // rst 0x20
  if (!m.call(0x0020)) return; // skipped: control never came back here

  regs.xor(regs.a);
  m.step(0x0765, 4);
  mem.write8(0x6392, regs.a);
  m.step(0x0768, 13);
  mem.write8(0x63a0, regs.a);
  m.step(0x076b, 13);
  regs.a = 0x01;
  m.step(0x076d, 7);
  mem.write8(0x6227, regs.a);
  m.step(0x0770, 13);
  mem.write8(0x6229, regs.a);
  m.step(0x0773, 13);
  mem.write8(0x6228, regs.a);
  m.step(0x0776, 13);

  m.step(0x0c92, 10); // jp 0x0c92 -- TAIL jump, no return address pushed
  m.call(0x0c92);
}
