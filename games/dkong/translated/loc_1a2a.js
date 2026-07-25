// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1a2a  (ROM 0x1A2A–0x1A30) — idx3 WAIT+EXIT: when (0x6216)==0, caller-skip loc_197a to its 0x19D2 tail.
 */
export function loc_1a2a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6216);
  m.step(0x1a2d, 13); // ld a,(0x6216)
  regs.and(regs.a);
  m.step(0x1a2e, 4); // and a
  if (regs.fNZ) { m.ret(11); return true; } // ret nz -- stay in state 3 while (0x6216) != 0
  m.step(0x1a2f, 5); // ret nz NOT taken
  m.pop16(); // pop hl -- HIDDEN EXIT: discards loc_197a's 0x19BF continuation
  m.step(0x1a30, 10);
  m.step(0x19d2, 10); // jp 0x19d2 -> loc_197a's shared tail
  m.call(0x19d2); // runs the tail; its ret returns to loc_197a's caller (dispatch)
  return false; // CALLER-SKIP: loc_197a must NOT continue past 0x19BF
}
