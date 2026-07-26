// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_33a1 — hand-optimized rewrite of the translated routine at ROM 0x33a1,
 * proven equal to its oracle by the equivalence harness.
 *
 * A CALLER-SKIP GATE with a threshold: it fires an `rst 0x30` bit-select gate on
 * A=0x07 (which may abort back to entry_333d early), and, if that gate passes,
 * compares the object's (ix+0x0f) coordinate against 0x59 — at-or-above returns
 * normally, below SPLICES the stack to skip its caller entirely. There is NO
 * absolute address in the routine itself (0x6227/BOARD is read inside sub_0030, the
 * callee, not here), so it imports no name from ram.js — like sub_3409. The record
 * offset (ix+0x0f) and the constants 0x07 (the rst bit-pattern) / 0x59 (the
 * threshold) stay hex: (ix+0x0f) is a field within the object record (the
 * record-offset trap, not a global), and the two literals are immediate operands.
 */

/**
 * sub_33a1 -- rst-0x30 bit-select gate, then a `(ix+0x0f) >= 0x59` threshold that
 * either returns normally or STACK-SPLICES to skip the caller. Returns a boolean the
 * caller (entry_333d) consumes as its skip signal.  [ROM 0x33A1-0x33AC, 8 insns]
 *
 *   33a1  3e 07        ld   a,0x07
 *   33a3  f7           rst  0x30            ; CALLER-SKIP GATE (sub_0030, A=0x07 bit-select)
 *   33a4  dd 7e 0f     ld   a,(ix+0x0f)
 *   33a7  fe 59        cp   0x59
 *   33a9  d0           ret  nc              ; (ix+0x0f) >= 0x59 -> NORMAL return
 *   33aa  33           inc  sp              ; STACK SPLICE (drop our own return address)
 *   33ab  33           inc  sp
 *   33ac  c9           ret                  ; ...so this ret lands in the caller's CALLER
 *
 * WHAT IT DOES -- TWO DIFFERENT CALLER-SKIPS in 12 bytes, and they are NOT the same
 * skip (per the ROM-wide rst doctrine; oracle docstring at translated/state0.js:4074):
 *
 *   1. `rst 0x30` (0x33A3) is a bit-select gate: sub_0030 rotates A (=0x07) right by
 *      the count at BOARD (0x6227) and, when the selected bit is CLEAR, discards the
 *      rst's return address and rets -- so control lands back in entry_333d at the
 *      instruction after `call 0x33a1`. From entry_333d's point of view that is a
 *      NORMAL (just early) return, so THIS routine returns TRUE (the `if
 *      (!m.call(0x0030)) return true;`). When the bit is SET, sub_0030 returns
 *      normally here and we fall through to the threshold.
 *   2. `ret nc` / `inc sp; inc sp; ret` (0x33A9-0x33AC) is the SECOND, different skip.
 *      `cp 0x59` sets carry when (ix+0x0f) < 0x59, so `ret nc` (the UNSIGNED test)
 *      fires the NORMAL return at-or-ABOVE 0x59 (returns TRUE). BELOW 0x59, the two
 *      `inc sp` discard sub_33a1's OWN return address, so the final `ret` goes to
 *      entry_333d's CALLER -- entry_333d is SKIPPED (returns FALSE, and entry_333d
 *      must `if (!m.call(0x33a1)) return;`).
 *
 * So the boolean means "was entry_333d returned to normally?" -- TRUE on BOTH the
 * rst-gate abort (1) and the normal ret-nc (2, >= 0x59); FALSE only on the below-0x59
 * stack splice. This mirrors the settled sub_0008 convention (identical ret-nc /
 * inc-sp / inc-sp / ret shape). IX is live-in (the object-record base; sub_0030 does
 * not touch IX, so (ix+0x0f) reads the same record after the gate).
 *
 * INPUTS  : A is set to 0x07 internally (the rst bit-pattern); IX = object record base
 *           (only +0f is read); RAM BOARD(0x6227) via sub_0030; the Z80 stack (this
 *           routine's own return + the caller's-caller return the splice pops).
 * OUTPUTS : the skip boolean (TRUE normal / FALSE splice). No work-RAM write of its
 *           own. Registers/F/SP/pc per arm:
 *   - gate-fired (rst abort): A/F/HL/B are sub_0030's (A rotated, F carry-clear,
 *     HL=0x6227, B=0), pc = entry_333d's continuation, SP consumed by one frame.
 *   - normal-ret (>= 0x59): A = (ix+0x0f), F = `cp 0x59` (carry clear), pc = the
 *     caller's continuation, SP one frame.
 *   - splice (< 0x59): A = (ix+0x0f), F = `cp 0x59` (carry set -- `inc sp`/`ret` are
 *     flag-neutral, so cp is the exit F), pc = the caller's CALLER, SP two frames.
 *
 * FLAGS -- nothing is droppable; the win is names, structure and the cycle collapse.
 *   - `ld a,0x07` is kept: 0x07 is sub_0030's bit-select input. (A is then clobbered
 *     by sub_0030 on the gate arm, or by `ld a,(ix+0x0f)` on the threshold arms.)
 *   - `cp 0x59` is kept VERBATIM (regs.cp): `ret nc` reads its carry, AND it is the
 *     last flag-writer before BOTH the normal-ret exit and the splice exit (`inc sp`
 *     is a 16-bit inc that does NOT touch F, and `ret` never does), so the observable
 *     exit F on both threshold arms must be exactly cp's result (the unit gate diffs
 *     the whole F, incl. F3/F5). sub_0030 sets its own A/F on the gate arm.
 *
 * CYCLES -- COLLAPSED per basic block, per-arm total preserved EXACTLY. The two
 * boundaries stay verbatim: the `rst 0x30` CALL (push16 + m.step + m.call, callee
 * charged inside sub_0030) is NOT folded across, and every `ret` keeps its own charge.
 * No hardware-latch write occurs anywhere (this routine writes no RAM at all; sub_0030
 * only reads work RAM 0x6227), so no tagged bus cycle is moved.
 *   - Prologue block   ld a,0x07 (7)                                      -> 7 t @0x33A3
 *   - rst 0x30         CALL boundary: m.step(0x0030,11) (callee excluded) -> 11 t
 *   - Threshold block  ld a,(ix+0x0f) (19) + cp 0x59 (7)                  -> 26 t @0x33A9
 *   - Splice block     ret-nc-not-taken (5) + inc sp (6) + inc sp (6)     -> 17 t @0x33AC
 *   Per-arm OWN totals (callee sub_0030 excluded, charged inside it):
 *     gate-fired : 7 + 11                                  = 18 t
 *     normal-ret : 7 + 11 + 26 + ret-nc-taken 11           = 55 t
 *     splice     : 7 + 11 + 26 + 17 + final ret 10         = 71 t
 *   These are the exact oracle per-instruction sums. Because each arm's total is
 *   preserved, the main loop's spin count (0x6019, the PRNG entropy) is unchanged.
 *   (Full totals INCLUDING the sub_0030 callee, deterministic per the crafted seeds
 *   the test pins: gate-fired 135 t (BOARD=4), normal-ret 107 t / splice 123 t
 *   (BOARD=1, sub_0030 = 52 t).)
 *
 * GATE = STRICT byte-exact whole-machine -- the routine is ATOMIC (so no convergent
 * gate). MEASURED over 1600 attract frames: 34 dispatches (non-vacuous), io.nmiMask
 * == 0 at 34/34 (every call runs mask-cleared INSIDE the vblank NMI, which cannot
 * re-enter), and the NMI's pushed PC NEVER lands in the routine body [0x33A1,0x33AC]
 * (0 of 1594 NMIs) nor in the sub_0030 body it calls. Atomic + total-preserving =>
 * byte-exact. Reached via loc_197a's NMI object cascade (entry_30ed -> 31b1 -> 3202 @
 * 0x3230 -> entry_333d @ 0x334A -> here), the SAME cascade that makes entry_33c3 /
 * sub_3409 atomic -- so the oracle docstring's "not yet wired / entry_333d
 * untranslated" note, and sub_0030's own list of sub_33a1 as a "mask-ENABLED
 * main-loop caller", are BOTH stale for this path (measured, not assumed).
 *
 * BRANCH COVERAGE -- attract exercises ONLY the normal-ret arm (all 34 dispatches:
 * BOARD==1 makes the rst gate's selected bit == 0x07's bit0 == SET, so the gate never
 * fires, and (ix+0x0f) is always >= 0x59 in the demo). The gate-fired arm (BOARD such
 * that 0x07's selected bit is clear, e.g. BOARD=4) and the below-0x59 splice arm are
 * proven from crafted identical-both-sides pokes with their exact cycle totals pinned;
 * see equivalence-33a1.test.js.
 */
export function sub_33a1(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // (ix+d) object-record field, IX live-in

  // Prologue: ld a,0x07 (7 t) -- the bit-pattern sub_0030 selects a bit from.
  regs.a = 0x07;
  m.step(0x33a3, 7);

  // rst 0x30 -- CALLER-SKIP GATE (call boundary, NOT folded across). Pushes 0x33a4,
  // charges the rst's own 11 t; sub_0030 (registry -> oracle or optimized) runs and
  // is charged internally. Returns false when the gate FIRED (selected bit clear):
  // sub_0030 has already unwound to entry_333d, so we report a NORMAL early return.
  m.push16(0x33a4);
  m.step(0x0030, 11);
  if (!m.call(0x0030)) return true; // gate fired: entry_333d WAS returned to (early)

  // Threshold block: ld a,(ix+0x0f) (19) + cp 0x59 (7) = 26 t @0x33A9. cp kept verbatim
  // -- `ret nc` reads its carry and it is the exit F on BOTH threshold arms.
  regs.a = mem.read8(R(0x0f));
  regs.cp(0x59);
  m.step(0x33a9, 26);
  if (regs.fNC) {
    // (ix+0x0f) >= 0x59 -- NORMAL return to the caller. ret nc taken (11 t). Own 55 t.
    m.ret(11);
    return true;
  }

  // (ix+0x0f) < 0x59 -- STACK SPLICE. Block: ret-nc-not-taken (5) + inc sp (6) +
  // inc sp (6) = 17 t @0x33AC. Discard our own return address so the final ret lands
  // in the caller's CALLER; entry_333d is skipped entirely. Own total 71 t.
  regs.sp = (regs.sp + 1) & 0xffff;
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x33ac, 17);
  m.ret(); // returns to the caller's CALLER
  return false; // entry_333d must return immediately
}
