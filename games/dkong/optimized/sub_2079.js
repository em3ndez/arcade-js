// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_2079 — hand-optimized rewrite of the translated routine at ROM 0x2079,
 * proven equal to its oracle by the equivalence harness.
 *
 * The routine touches an object slot through IX (a pointer into the 10-slot object
 * array at 0x6700, stride 0x20 — the 25m barrels). Those are IX-RELATIVE struct
 * fields, not fixed RAM addresses, so they are named with local offset constants
 * here and NOT proposed for ram.js (which maps absolute addresses). Its one callee,
 * the shared object-sprite tail at 0x21ba, is reached by a tail jump through
 * `m.call` (the routine registry), never copied here.
 */

// -- object-slot field offsets (relative to IX = slot base in the 0x6700 array) --
const SLOT_ACTIVE = 0x00; // slot-active flag: 0 = free, 1 = live. loc_1f83 (ROM 0x1F86)
//                            dispatches a slot only while (ix+0)==1; clearing it frees the slot.
const SLOT_X = 0x03;      // object X coordinate: velocity-stepped by branch_1fe5/1fef
//                            (inc/dec (ix+3), ROM 0x1FEC/0x1FF6) and bounds-checked against
//                            0x1c/0xe4 by shared_1ff6 (ROM 0x201A). Cleared on deactivate.

/**
 * sub_2079 -- DEACTIVATE an object slot whose X ran off the left edge.  [ROM 0x2079-0x2082,
 * then TAIL-JUMPS into the shared object-sprite tail @ 0x21ba]
 *
 *   2079  af           xor  a            ; A = 0 (and Z=1, all other flags cleared)
 *   207a  dd 77 00     ld   (ix+0x00),a  ; SLOT_ACTIVE = 0  -- free the slot
 *   207d  dd 77 03     ld   (ix+0x03),a  ; SLOT_X      = 0  -- clear its X
 *   2080  c3 ba 21     jp   0x21ba       ; TAIL jump into the shared slot-loop tail
 *
 * WHAT IT DOES. This is the "off-screen -> retire it" arm of the barrel/object mover.
 * Its sole caller, branch_2053 (ROM 0x2061), reads SLOT_X, does `add 0x08; cp 0x10`
 * and `jp c` here when SLOT_X + 8 < 0x10 -- i.e. SLOT_X wrapped into 0xF8..0x07, the
 * object has walked off the low (left) edge of the play-field. sub_2079 retires that
 * slot: it zeroes SLOT_ACTIVE so the slot scanner (loc_1f83) stops dispatching it, and
 * zeroes SLOT_X, then tail-jumps to the shared tail 0x21ba which unswaps the loop's
 * register set (its leading `exx`) and re-enters the slot loop at 0x1f8d for the next
 * slot. loc_2104 (ROM 0x2104) is the structural twin: it inlines the very same
 * `(ix+3)+8 < 0x10` test and, on the deactivate arm, the identical
 * `xor a; ld (ix+0),a; ld (ix+3),a; jp 0x21ba` body.
 *
 * INPUTS  : IX = the object slot base (a 0x6700-array entry). The stack holds the
 *           caller return address that 0x21ba's tail ultimately `ret`s to.
 * OUTPUTS : RAM (ix+0)=0 and (ix+3)=0; then 0x21ba's effects (register unswap + the
 *           slot-loop continuation). Register file A=0 and F = the flags of `xor a`
 *           (Z set, C/N/H/S/P/V clear) at entry to 0x21ba, plus whatever 0x21ba then
 *           leaves. No boolean is returned; the tail jump's result is propagated for
 *           hygiene (the slot loop ignores it), matching the oracle.
 *
 * FLAGS -- KEPT VERBATIM. `xor a` is the routine's only flag writer and produces the
 * A=0 that BOTH stores use, so it is written as the canonical `regs.xor(regs.a)` idiom
 * rather than a bare `regs.a = 0` -- that keeps F byte-exact for the whole-register-file
 * gate (the NMI pushes AF into diffed RAM) at zero readability cost. There is no dead
 * register churn to drop: every operation here is load-bearing.
 *
 * CYCLES -- COLLAPSED to a single m.step. The routine is straight-line (no branch),
 * both stores target object-slot WORK RAM (0x67xx, never a hardware latch), so the
 * four per-instruction charges (4 + 19 + 19 + 10) fold into one 52 t charge at the
 * tail's exit PC 0x21ba, immediately before the control transfer -- the oracle's exact
 * total. sub_2079 is NOT atomic: it runs deep inside loc_197a's interruptible per-frame
 * cascade (0x197a -> sub_1f72 -> branch_2053 -> here), so the vblank NMI can land inside
 * it. The collapse is therefore LICENSED by the CONVERGENT gate (equivalence-2079.test.js
 * uses convergentGate, not the strict whole-machine gate): a mistimed NMI pushes the
 * coarse block-exit PC into the DEAD stack scratch (excluded) or leaves a self-healing
 * one-frame raster tear; total-preservation keeps the main loop's spin count (0x6019,
 * the PRNG entropy) deterministic, so nothing persistent diverges.
 *
 * The `jp 0x21ba` is a TAIL jump with NO push16: 0x21ba's own `ret` returns to
 * sub_2079's caller, not to here. 0x21ba is reached via `m.call(0x21ba)` so it resolves
 * to the oracle or its own optimized rewrite; `return` propagates its (inert) answer.
 */
export function sub_2079(m) {
  const { regs, mem } = m;
  const slot = (field) => (regs.ix + field) & 0xffff;

  regs.xor(regs.a);                    // A = 0 (Z=1); the value both stores write.
  mem.write8(slot(SLOT_ACTIVE), regs.a); // free the slot -- scanner stops dispatching it
  mem.write8(slot(SLOT_X), regs.a);      // clear the off-screen X

  // xor a (4) + ld (ix+0),a (19) + ld (ix+3),a (19) + jp 0x21ba (10) = 52 t, exit 0x21ba.
  m.step(0x21ba, 52);
  // TAIL jump: NO push16, so 0x21ba's ret returns to OUR caller.
  return m.call(0x21ba);
}
