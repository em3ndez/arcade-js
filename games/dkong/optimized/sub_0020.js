// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0020 — hand-optimized rewrite of the translated routine at ROM 0x0020,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x0018 = sub_0018, the rst 0x18 helper)
 * is reached through `m.call`, the routine registry (games/dkong/routines.js),
 * so it resolves to the oracle or to a future optimized rewrite. Only the RAM
 * name SUBSTATE_TIMER_LO is imported (from ram.js).
 */

import { SUBSTATE_TIMER_LO } from "./ram.js";

/**
 * sub_0020 -- the `rst 0x20` skip helper: LOW half of a two-byte prescaler.
 * [ROM 0x0020-0x0027]
 *
 *   0020  21 08 60   ld   hl,0x6008     ; hl -> SUBSTATE_TIMER_LO
 *   0023  35         dec  (hl)          ; tick the low prescaler; Z on underflow
 *   0024  28 f2      jr   z,0x0018      ; expired -> TAIL jump into sub_0018
 *   0026  e1         pop  hl            ; loc_0026: discard THIS ret address ...
 *   0027  c9         ret                ; ... and return to the caller's CALLER
 *
 * A LEAF reached only via `m.call(0x0020)` from many substate handlers, always
 * through the caller-skip idiom `m.push16(ret); m.call(0x0020); if (!m.call(...)) return;`
 * -- i.e. the caller pushes its own resume address, then consumes the boolean.
 *
 * WHAT IT DOES. It decrements the low prescaler at 0x6008 and gates whether the
 * caller's remainder runs, forming the low (fast) half of a two-level countdown
 * whose high half is sub_0018 on 0x6009 (SUBSTATE_TIMER):
 *
 *   - 0x6008 did NOT underflow (result != 0): `pop hl / ret` discards this
 *     routine's own return address and returns to the CALLER'S CALLER -- the
 *     "skip". The caller's `if (!m.call(0x0020)) return;` then bails. Returns
 *     FALSE. SP nets +4 (two pops: pop hl, then ret), HL = the discarded
 *     return address, PC = the caller's caller.
 *
 *   - 0x6008 DID underflow (result == 0): the `jr z` is a genuine TAIL jump onto
 *     sub_0018's first instruction (0x0018) -- not a call. sub_0018 ticks the
 *     HIGH prescaler at 0x6009 and, by the SAME convention, returns TRUE only
 *     when it too expires (both counters reach zero together), else FALSE. Its
 *     `ret`/`inc sp;inc sp;ret` performs all of this branch's SP work and its
 *     boolean is sub_0020's result -- hence `return m.call(0x0018)`.
 *
 * So the caller's guarded body runs only when BOTH prescalers expire on the
 * same frame: two prescalers in series, expressed as a jump between two `rst`
 * handlers sharing a return convention. This routine owns no `ret` of its own on
 * the taken branch -- sub_0018's `ret` returns on 0x0020's behalf.
 *
 * INPUTS  : RAM 0x6008 (read+decremented); on the taken branch, RAM 0x6009 via
 *           sub_0018. The stack (a valid caller return address to pop).
 * OUTPUTS : RAM 0x6008 (decremented). Register file: HL (pointer, then the popped
 *           return address on the not-taken branch), F (from `dec (hl)`), SP, PC.
 *           Boolean return consumed by every caller.
 *
 * FLAGS -- KEPT VERBATIM. `dec (hl)`'s Z is load-bearing twice over: it selects
 * the branch here AND the unit gate compares the whole register file (F included)
 * on return. No later instruction on the not-taken branch touches F, so F on
 * return is exactly `dec8`'s result; on the taken branch F is whatever sub_0018
 * leaves. `regs.dec8` is therefore kept, not elided.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. This routine is NOT atomic:
 * it is a leaf `rst` helper entered from many substate contexts (some in the NMI
 * game-state path, some in the main loop), short enough for a vblank NMI to land
 * INSIDE it -- and the taken branch further calls the interruptible sub_0018. A
 * collapse's only observable effect on such an interrupted path is the coarse PC
 * pushed into the dead stack or a healing single-frame pixel tear -- never a
 * persistent divergence, since the fold does not cross the RAM write (its order
 * and value are unchanged) or any hardware write (0x6008 is work RAM, not a
 * 0x7Dxx latch). This is licensed by the CONVERGENT gate (same reasoning as
 * sub_0350; equivalence-0020.test.js uses convergentGate, not the strict
 * whole-machine gate). Block totals are the oracle's EXACTLY: prologue (ld
 * hl,0x6008[10] + dec (hl)[11] = 21 t) common to both branches; taken = prologue
 * + jr-z-taken[12] = 33 t before the sub_0018 tail call; not-taken = prologue +
 * (jr-z-not-taken[7] + pop hl[10] = 17 t) + ret's own charge[10] = 48 t. The ret's
 * own charge is kept as a separate `m.ret()` call (not folded into the preceding
 * step), matching the sub_0350 convention.
 *
 * @returns {boolean} true when control returns after the `rst` (caller's body
 *   runs), false when it skipped (caller must return immediately).
 */
export function sub_0020(m) {
  const { regs, mem } = m;

  // ld hl,0x6008 (10) + dec (hl) (11) -- tick the low prescaler; Z is set when it
  // underflows to zero. (0x6008 is work RAM, not a hardware latch, so the
  // busOffset 8 is inert -- kept for fidelity.) Folded: 21 t, common prologue.
  regs.hl = SUBSTATE_TIMER_LO;
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8);
  m.step(0x0024, 21);

  if (regs.fZ) {
    // jr z 0x0018 taken -- TAIL jump into sub_0018 (the high prescaler on 0x6009).
    // Its ret returns on this routine's behalf; propagate its boolean unchanged.
    m.step(0x0018, 12);
    return m.call(0x0018);
  }

  // jr z not taken (7) + pop hl (10) -- discard THIS routine's return address;
  // ret then returns to the caller's CALLER -- the skip. Returns false.
  regs.hl = m.pop16();
  m.step(0x0027, 17);
  m.ret(); // ret's own 10 t charge, kept separate (matches the sub_0350 convention)
  return false;
}
