// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1d03 — hand-optimized rewrite of the translated routine at ROM 0x1D03,
 * proven equal to its oracle by the equivalence harness (equivalence-1d03.test.js).
 *
 * One routine per file. Its two hand-off targets (0x1d76 = loc_1d76, the timer-running
 * branch; 0x1d11 = loc_1d11, the shared walk/climb body) are invoked through `m.call`,
 * the routine registry (games/dkong/routines.js), so each resolves to the oracle or to
 * its own optimized rewrite — never a copy here. Only the RAM *name* is imported.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";

/**
 * entry_1d03 -- the "climb up" arm of the on-ladder animation stepper. [ROM 0x1D03-0x1D11]
 *
 *   1d03  3a 0f 62     ld   a,(0x620f)   ; A = MARIO_MOVE_STEP_TIMER (4-frame walk/climb timer)
 *   1d06  a7           and  a            ; Z := (timer == 0)
 *   1d07  c2 76 1d     jp   nz,0x1d76    ; timer still running -> loc_1d76 (timer-running branch)
 *   1d0a  3e 04        ld   a,0x04
 *   1d0c  32 0f 62     ld   (0x620f),a   ; timer expired -> reset it to 4
 *   1d0f  3e fe        ld   a,0xfe       ; A = delta = -2 (climb UP), LIVE-IN to loc_1d11
 *   1d11  ...          (falls into the shared body loc_1d11)
 *
 * WHAT IT DOES. Reached ONLY from loc_1b45's `jp nz` (0x1B4A) — the on-ladder input chain,
 * once it has established Mario is on a ladder with Up held. It advances the 4-frame step
 * timer 0x620F:
 *   - ARM A -- timer != 0: still counting; hand off to loc_1d76 (0x1D76), which gates on
 *     0x621A and either decrements the timer (shared tail entry_1d8a) or updates the
 *     climb-limit fields. A `jp nz` TAIL jump: no push16, loc_1d76's own `ret` returns to
 *     entry_1d03's caller.
 *   - ARM B -- timer == 0: reset the timer to 4 and fall into the shared body loc_1d11
 *     (0x1D11) with A = 0xFE (delta -2). loc_1d11 does MARIO_Y (0x6205) += delta and cycles
 *     the walk frame. The twin loc_1cf2 enters the SAME body with A = +2 (delta down); the
 *     delta is passed in A, which is why A = 0xFE must be live at the hand-off. Modelled as
 *     a tail `m.call(0x1d11)` (its chain's `ret` returns to entry_1d03's caller).
 *
 * INPUTS  : RAM 0x620F (MARIO_MOVE_STEP_TIMER). The stack (a caller return address; on both
 *           arms the callee's own `ret` returns there).
 * OUTPUTS : ARM B writes 0x620F := 4; both arms then run their callee live (loc_1d76 /
 *           loc_1d11 and below), whose effects — Mario Y 0x6205, sprite/anim bytes,
 *           0x6215/0x6219 — are the routine's real output. Register file at the hand-off:
 *           ARM A A = timer, F = `and a` result; ARM B A = 0xFE, F = `and a` on 0 (Z=1),
 *           plus SP/PC. No boolean is returned; the caller (loc_1b45's chain up to loc_197a)
 *           ignores it, so the tail hand-off's result is inert but `return`ed for hygiene
 *           (matches the oracle).
 *
 * FLAGS -- `and a` is KEPT VERBATIM (`regs.and(regs.a)`): it is this routine's `jp nz`
 * decider AND its last flag-writer before both hand-offs (`jp`/`ld` touch no flags), so the
 * F it leaves is the F the unit gate compares byte-for-byte at the boundary. It is NOT
 * simplified to `timer !== 0`: the Z80 AND-a's H=1/N=0/C=0 and its S/P/F3/F5 side-effects
 * are observable. A is likewise left = the timer on ARM A (AND-a does not write A); on ARM B
 * A is deliberately set to 0xFE, the delta loc_1d11 reads. The incoming F/A are dead in both
 * callees (loc_1d76 reloads A+`and`, loc_1d11 does `add a,(hl)`) — kept anyway for a byte-
 * exact boundary. The only register churn to drop is the oracle's `ld a,0x04` scratch: the
 * timer reset is written as a plain literal `mem.write8(...,0x04)`, so A is not clobbered
 * through it (the oracle reloads A = 0xFE right after regardless, so the exit A is identical).
 *
 * CYCLES -- COLLAPSED per the decompiler-pipeline doc: each executed path's straight-line T-states are folded into
 * ONE charge placed immediately before that arm's control transfer, preserving the oracle's
 * per-arm TOTAL exactly. The routine's only write, 0x620F := 4, is WORK RAM, not a tagged
 * hardware latch, so no bus-cycle boundary is crossed and a full fold is safe. Per-arm OWN
 * totals (excluding the tail callee):
 *   - ARM A (timer != 0): ld 13 + and 4 + jp-nz-taken 10                     = 27 t -> 0x1d76
 *   - ARM B (timer == 0): 13 + 4 + jp-nz-not-taken 10 + ld 7 + ld 13 + ld 7  = 54 t -> 0x1d11
 * (Z80: JP cc is 10 t taken or not.) The m.call hand-offs are boundaries and are NOT folded
 * across.
 *
 * GATE = STRICT whole-machine, MEASURED. entry_1d03 is ATTRACT-REACHABLE (58 dispatches over
 * 1200 attract frames; first ~f842, once the demo climbs a ladder — the loc_1b45 docstring's
 * "0 whole-machine dispatches" is STALE, measured on a 600-frame window that ends before that
 * first climb) and ATOMIC: its sole caller loc_1b45 sits in the loc_197a / entry_1ac3 cascade,
 * which runs mask-cleared inside the vblank NMI — measured io.nmiMask == 0 at 58/58 dispatches,
 * so the NMI cannot re-enter and no NMI pushed-PC can land in [0x1d03,0x1d11). Its collapse
 * preserves each arm's TOTAL exactly and its one write is work RAM (no raster tear), so it is
 * byte-exact: the STRICT gate passes directly (no convergent gate needed). That gate is
 * timing-sensitive — a wrong total forks the spin-count PRNG (0x6019) and a later NMI's pushed
 * PC — so it pins BOTH naturally-reached arms' totals for free (ARM A 46x, ARM B 12x). The unit
 * tests add full-branch coverage with explicit per-arm cycle-total teeth. See
 * equivalence-1d03.test.js.
 */
export function entry_1d03(m) {
  const { regs, mem } = m;

  // Read the 4-frame walk/climb step timer and test it (Z := timer == 0).
  regs.a = mem.read8(MARIO_MOVE_STEP_TIMER);
  regs.and(regs.a); // decides the jp nz; this is ARM A's / the boundary's exit F.

  if (regs.fNZ) {
    // ARM A -- timer still running: hand off to the timer-running branch loc_1d76.
    // 13 + 4 + jp-nz-taken 10 = 27 t, PC -> 0x1d76. Tail jump: no push16, loc_1d76's
    // own ret returns to OUR caller.
    m.step(0x1d76, 27);
    return m.call(0x1d76);
  }

  // ARM B -- timer expired: reset it to 4 and step Mario UP via the shared body loc_1d11,
  // which reads the delta from A. 13 + 4 + jp-nz-not-taken 10 + ld 7 + ld 13 + ld 7 = 54 t,
  // PC -> 0x1d11. Tail call: loc_1d11's chain's ret returns to OUR caller.
  mem.write8(MARIO_MOVE_STEP_TIMER, 0x04); // reset timer := 4 (work RAM, not a latch)
  regs.a = 0xfe; // delta = -2 (climb up), LIVE-IN to loc_1d11
  m.step(0x1d11, 54);
  return m.call(0x1d11);
}
