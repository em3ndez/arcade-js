// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2257  (ROM 0x2257–0x2258) — pop hl / ret: caller-skip to the grandparent. Returns false so the.
 *  caller (loc_2227/loc_2259) PROPAGATES the skip and does NOT run its own tail/ret
 *  (the pop hl + ret here already unwound this frame + the grandparent's return).
 */
export function loc_2257(m) {
  const { regs } = m;
  regs.hl = m.pop16();
  m.step(0x2258, 10); // pop hl
  m.ret(10); // ret -> caller's caller
  return false;
}
