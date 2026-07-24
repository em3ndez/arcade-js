// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1d8a — hand-optimized rewrite of the translated routine at ROM 0x1D8A,
 * proven equal to its oracle by the equivalence harness.
 *
 * This is the SHARED animation-timer decrement TAIL of the player walk/climb steppers:
 * entry_1d03 (0x1D7A jp z) and its twin loc_1cf2 (0x1CF6 jp nz) both route into it via
 * loc_1d76. It is NEVER `call`ed — its `ret` returns to the animation routine's caller
 * (the per-frame update cascade), so the decrement it performs is what advances the walk/
 * climb sub-step frame each tick. Straight-line (one path, no branch).
 *
 * NAME: 0x620F is already `MARIO_MOVE_STEP_TIMER` in ram.js — the ground walk/climb
 * sub-step timer, evidenced there by a CONTROL poke ("poking 20 gives 20 frames of
 * 1px/frame") and cross-corroborated by the reload sites (2 walk / 3-4 climb). So this
 * rewrite IMPORTS the confirmed name (entry_1da6's convention) and proposes NO new
 * candidate. NB: the translated MOVE routines (loc_1c8f/loc_1cab) carry a STALE
 * "jump phase" comment on the same address; ram.js already corrects it ("NOT jump
 * phase -- a jump never touches it"), so the meaning here is unambiguous.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js"; // 0x620F — walk/climb sub-step timer

/**
 * entry_1d8a -- decrement the walk/climb sub-step timer and return.  [ROM 0x1D8A-0x1D8E]
 *
 *   1d8a  21 0f 62     ld   hl,0x620f     ; HL -> MARIO_MOVE_STEP_TIMER
 *   1d8d  35           dec  (hl)          ; RMW: [0x620F]-- , sets S/Z/H/PV/N (carry kept)
 *   1d8e  c9           ret                ; back to the animation routine's caller
 *
 * WHAT IT DOES. Decrements the byte at 0x620F (the sub-step timer, NOT the HL pointer —
 * `dec (hl)` is the read-modify-write of the *memory* byte) and returns. The resulting
 * Z flag is OBSERVABLE and load-bearing: a caller branching on "timer reached 0" reads
 * the Z that this decrement leaves. 0x620F is WORK RAM (Mario's 0x62xx state region),
 * not a hardware latch.
 *
 * INPUTS  : RAM 0x620F (the current timer). The stack (a return address for `ret`).
 *           Incoming carry (preserved into the exit F -- see FLAGS).
 * OUTPUTS : RAM 0x620F := (timer - 1) & 0xFF. Registers on exit: HL = 0x620F (the `ld`
 *           sets it; `dec (hl)` does NOT change HL), F = dec's S/Z/H/PV/N with carry
 *           preserved, A/BC/DE/IX/IY untouched. PC/SP move via `ret`. `return` forwards
 *           the (inert) result of m.ret.
 *
 * FLAGS -- KEPT verbatim via decMem8 (which routes through regs.dec8), because the exit F
 *   is OBSERVABLE and NOT droppable: `dec (hl)` is the LAST flag-writer before `ret` (ret
 *   sets none), so it defines the exit S/Z/H/PV/N, and a caller may branch on the Z. `dec`
 *   never touches carry, so the entry carry survives to the exit F unchanged -- also
 *   observable. The unit gate compares the whole register file (incl. F and the
 *   undocumented F3/F5 bits), so reproducing dec8's exact result is required. Nothing here
 *   is a dead flag to drop.
 *
 * CYCLES -- COLLAPSED: `ld hl` (10 t) + `dec (hl)` (11 t) form one basic block and fold to
 *   a SINGLE m.step at the block's exit PC 0x1D8E = 21 t; then m.ret (10 t) -> 31 t total,
 *   exactly the oracle (10 + 11 + 10). The fold crosses the write to 0x620F, which is safe:
 *   0x620F is WORK RAM, not a tagged hardware latch (0x7800-0f / 0x7C00 / 0x7C80 /
 *   0x7D00-07 / 0x7D80-87), so no hidden bus cycle sits inside the block and no write-trace
 *   boundary is moved. No call boundary either (it is a pure leaf). total-preservation keeps
 *   the main-loop spin count 0x6019 (PRNG entropy) unchanged.
 *
 * GATE / REACHABILITY / ATOMICITY (MEASURED, not assumed -- the oracle's "NEVER called"
 *   note is about `call` vs tail-jump and is accurate; its reachability is what was
 *   re-measured). STRICT whole-machine gate. Probed over an all-oracle attract run: 0
 *   dispatches through f800, then a burst of 46 by f900 (once the attract demo is playing
 *   25m and Mario walks/climbs), stable 46 through f1300; 0 in driven gameplay in the
 *   window measured. So the whole-machine gate is NON-vacuous (46 invocations). It is
 *   ATOMIC on every measured path: EVERY one of the 46 entries occurs INSIDE the NMI
 *   handler with the NMI mask CLEARED (in-NMI 46/46, mask-set 0/0), and entry_1d8a is a
 *   pure LEAF (no m.call) so the mask stays clear through its whole body and the NMI cannot
 *   re-enter -- no pushed PC can land in [0x1D8A,0x1D8E]. An atomic byte-exact collapse
 *   pushes no mistimed PC and tears no raster, so it passes the STRICT gate directly and
 *   does NOT need the convergent gate. See equivalence-1d8a.test.js.
 */
export function entry_1d8a(m) {
  const { regs, mem } = m;

  // Block: ld hl,0x620f (10) + dec (hl) (11) = 21 t, exit PC 0x1D8E.
  regs.hl = MARIO_MOVE_STEP_TIMER;   // ld hl,0x620f  -- HL is an observable output (0x620F)
  regs.decMem8(mem, regs.hl);        // dec (hl): [0x620F]-- , RMW the BYTE (not HL), sets flags
  m.step(0x1d8e, 21);

  m.ret(10); // ret to the animation routine's caller (10 t)
}
