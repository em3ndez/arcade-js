// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0018 — hand-optimized rewrite of the translated routine at ROM 0x0018,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It is a LEAF (calls nothing) reached through `m.call`,
 * the routine registry (games/dkong/routines.js), so installing this override
 * swaps it at EVERY call site, not just a dispatch point. Only the RAM name
 * SUBSTATE_TIMER is imported (from ram.js).
 */

import { SUBSTATE_TIMER } from "./ram.js";

/**
 * sub_0018 -- the `rst 0x18` skip helper: a "do it every Nth frame" gate.
 * [ROM 0x0018-0x001F]
 *
 *   0018  21 09 60     ld   hl,0x6009      ; HL = &SUBSTATE_TIMER
 *   001b  35           dec  (hl)           ; tick the countdown, sets Z
 *   001c  c8           ret  z              ; expired: NORMAL return
 *   001d  33           inc  sp             ; else discard own return addr...
 *   001e  33           inc  sp
 *   001f  c9           ret                 ; ...and return to the CALLER'S CALLER
 *
 * WHAT IT DOES. Decrements the sub-state countdown at 0x6009 (SUBSTATE_TIMER) in
 * place. When it reaches ZERO the routine returns normally, so the caller's
 * remainder runs -- "the timer expired, do the thing". While it is still
 * non-zero the two `inc sp` pop this routine's OWN return address off the stack
 * and the final `ret` returns to the caller's caller, skipping whatever followed
 * the `rst` in the caller. Polarity matters: the caller's remainder runs only on
 * EXPIRY, not while counting -- reading it the other way inverts the routine.
 *
 * It is invoked from ~50 sites as `m.step(0x0018,11); if (!m.call(0x0018)) return;`
 * and, notably, is TAIL-JUMPED into by sibling sub_0020 on its expiry branch
 * (`return m.call(0x0018)`, forming the high half of a two-level prescaler). The
 * translation models the two-level stack unwind as a BOOLEAN the caller consumes:
 * true = control came back after the `rst` (run the remainder), false = it
 * skipped (caller returns immediately).
 *
 * INPUTS  : (0x6009) SUBSTATE_TIMER, the current stack (SP + its two 16-bit slots).
 * OUTPUTS : (0x6009) decremented; HL = 0x6009; F set by `dec (hl)`; SP advanced
 *           (+2 on the expiry branch via the `ret` pop; +4 on the skip branch --
 *           two `inc sp` then the `ret` pop); PC = the popped return address.
 *           Return value: true on expiry, false on skip.
 *
 * CONTRACT PRESERVED (the unit gate compares RAM + the WHOLE register file incl.
 * SP + F + PC, and callers consume the boolean):
 *   - HL is left at 0x6009 (the oracle's `ld hl`), so it matches.
 *   - `dec (hl)` is kept VERBATIM as regs.dec8 so F -- S,Z,H,P/V,N, carry
 *     preserved -- matches exactly; Z is both the branch decider and, via an
 *     NMI-pushed AF, reaches RAM, so it is not a droppable flag.
 *   - SP: the skip branch does two `inc sp` BEFORE the `ret`, so the popped slot
 *     and the final SP match the oracle byte-for-byte. This SP manipulation is
 *     the whole point of the routine and is preserved literally.
 *
 * CYCLES -- COLLAPSED to one m.step/m.ret per basic block. sub_0018 is a leaf, but
 * it is NOT atomic on every path: it is reached from INTERRUPTIBLE contexts --
 * sub_0020's expiry tail-jump and many in-game substate callers -- not only the
 * mask-cleared NMI-dispatch path. On an interruptible path the vblank NMI can be
 * accepted at an instruction boundary INSIDE this ~4-instruction routine, and
 * fireNmi pushes the CURRENT PC (0x001b/0x001c/0x001d/0x001e/0x001f) into diffed
 * stack RAM. Collapsing the per-instruction m.step charges to one per-branch lump
 * moves where a mid-routine NMI lands (README §2's "NMI lands mid-logic" caveat),
 * so this collapse is INTERRUPTIBLE and is licensed by the CONVERGENT gate (not
 * the strict whole-machine gate) -- see the accompanying equivalence test. The
 * oracle's per-branch TOTALS are preserved EXACTLY (expiry 10+11+11 = 32 t, skip
 * 10+11+5+6+6+10 = 48 t), each charged as a single combined m.ret call. The one
 * store is to WORK RAM (0x6009), not a 0x7Dxx hardware latch, so there is no
 * bus-cycle position to pin separately.
 *
 * @returns {boolean} true when control returns after the `rst` (caller's
 *   remainder runs), false when it skipped (caller must return immediately).
 */
export function sub_0018(m) {
  const { regs, mem } = m;

  // Shared prefix: ld hl,0x6009(10) + dec (hl)(11) = 21 t. (0x6009 is work RAM, not a
  // hardware latch, so the busOffset 8 is inert -- kept for fidelity.)
  regs.hl = SUBSTATE_TIMER;
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8);

  if (regs.fZ) {
    // ret z taken -- counter EXPIRED: normal return, caller's remainder runs.
    // Whole path (prefix 21 + ret z taken 11) = 32 t, one combined charge.
    m.ret(32);
    return true;
  }

  // ret z NOT taken(5) + inc sp(6) + inc sp(6) + ret(10) = 27 t; discards THIS routine's
  // own return address then returns to the caller's CALLER -- the skip. The two SP
  // increments happen here (values unaffected by cycle-charge granularity); the whole
  // path (prefix 21 + 27) = 48 t is charged in one combined m.ret call.
  regs.sp = (regs.sp + 1) & 0xffff;
  regs.sp = (regs.sp + 1) & 0xffff;
  m.ret(48);
  return false;
}
