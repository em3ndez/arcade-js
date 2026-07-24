// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_11fa — hand-optimized rewrite of the translated routine at ROM 0x11FA,
 * proven equal to its oracle by the equivalence harness. A straight-line record scatter;
 * it names no work RAM (operands are the caller's HL and the fixed IX/DE bases).
 */

/**
 * sub_11fa -- scatter a source record into an IX object slot (and mirror it).  [ROM 0x11FA-0x1229]
 *
 * Reached from the per-board setups (loc_0fd7 supplies HL=0x3DF4). Straight-line, no loop.
 * IX = 0x66A0 (the object slot), DE = 0x6A28 (a mirror in the sprite buffer). It marks the
 * slot live (IX+0 = 0x01) then reads six consecutive source bytes (HL) and scatters them:
 *   src0 -> IX+3 and DE+0,  src1 -> IX+7 and DE+1,  src2 -> IX+8 and DE+2,
 *   src3 -> IX+5 and DE+3,  src4 -> IX+9 (no mirror), src5 -> IX+0A (no mirror).
 * The IX offsets are +3,+7,+8,+5 in that order (the same permutation sub_11d3 gathers), and
 * the DE mirror advances by `inc e` (D fixed) for the first four only, ending at 0x6A2B.
 * HL exits at source+6. The `ld (ix+d),0x01` at 0x1205 is the IMMEDIATE form (dd 36 d n).
 *
 * CYCLES -- COLLAPSED to a SINGLE m.step spanning the whole routine: straight-line,
 * no branch, no loop, no callee (nothing to hold a boundary open for), and no
 * hardware-bus write (0x66A0/0x6A28 are ordinary work RAM) -- so nothing pins an
 * intermediate step. Total is the oracle's EXACTLY: 14+10+19+7+19+7+4+6+7+19+7+4+6+
 * 7+19+7+4+6+7+19+7+6+7+19+6+7+19 = 269 t, exit at the `ret`'s own address 0x1229
 * (the `ret` itself is the routine's own return scaffolding and stays a separate
 * `m.ret()` charge, per the collapse rule).
 *
 * GATED CONVERGENT, not strict: reached from the per-board setups, whose atomicity
 * is not pinned to the mask-cleared NMI (loc_0fd7 runs during the interruptible
 * attract cascade). Per the collapse-sweep's blanket rule, any routine with a
 * whole-machine test is gated convergent unconditionally, since "passes strict" is
 * a property of the tested scenario, not a proof the routine is atomic on every
 * trajectory. See equivalence-11fa.test.js.
 */
export function sub_11fa(m) {
  const { regs, mem } = m;

  regs.ix = 0x66a0;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01); // ld (ix+0x00),0x01 -- mark slot live
  regs.de = 0x6a28;

  // src0 -> IX+3, mirror DE+0
  regs.a = mem.read8(regs.hl); // HL is the caller's, never set here
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e); // `inc e` -- D untouched
  regs.hl = (regs.hl + 1) & 0xffff;

  // src1 -> IX+7, mirror DE+1
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e);
  regs.hl = (regs.hl + 1) & 0xffff;

  // src2 -> IX+8, mirror DE+2
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e);
  regs.hl = (regs.hl + 1) & 0xffff;

  // src3 -> IX+5 (+5 AFTER +8), mirror DE+3 -- no inc e after, DE stays 0x6A2B
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.hl = (regs.hl + 1) & 0xffff;

  // src4 -> IX+9 (no mirror)
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);
  regs.hl = (regs.hl + 1) & 0xffff;

  // src5 -> IX+0A (no mirror). HL exits at source+6.
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);

  m.step(0x1229, 269); // COLLAPSED: whole straight-line body, one basic block
  m.ret(); // 0x1229
}
