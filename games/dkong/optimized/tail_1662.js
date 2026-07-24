// SPDX-License-Identifier: GPL-3.0-only
/**
 * tail_1662 — hand-optimized rewrite of the translated routine at ROM 0x1662,
 * proven equal to its oracle by the equivalence harness. It touches the animation counter
 * 0x6388 and the sprite block 0x690B (unnamed in ram.js), so those stay hex.
 */

/**
 * tail_1662 -- bump the animation counter and step the sprite block.  [ROM 0x1662-0x1670]
 *
 * Two callers. It increments the counter at 0x6388, then rst 0x30 with A=1 -- a caller-skip
 * guard (the sub_0030 convention: if it aborts, return to this routine's caller). Otherwise
 * rst 0x38 subtracts 4 (C=0xFC) from each of the 10 bytes at 0x690B, then rets.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (folded up to and including each
 * call/rst's own dispatch charge, matching sub_0350's template). Two call paths, not all
 * provably mask-cleared; the rst guard's skip-boolean is honored and callees route through
 * m.call (kept unfolded, never inlined).
 */
export function tail_1662(m) {
  const { regs, mem } = m;

  // ld hl,0x6388(10)+inc (0x6388)(11)+ld a,0x01(7)+rst 0x30's own dispatch charge(11) = 39 t.
  regs.hl = 0x6388;
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (0x6388)
  regs.a = 0x01;
  m.push16(0x1669);
  m.step(0x0030, 39);
  if (!m.call(0x0030)) return; // rst 0x30 caller-skip

  // ld hl,0x690b(10)+ld c,0xfc(7)+rst 0x38's own dispatch charge(11) = 28 t.
  regs.hl = 0x690b;
  regs.c = 0xfc; // -4
  m.push16(0x166f);
  m.step(0x0038, 28);
  m.call(0x0038); // rst 0x38 -- subtract 4 from each of 10 bytes at 0x690B

  m.ret(10);
}
