// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d76 — hand-optimized rewrite of the translated routine at ROM 0x1D76,
 * proven equal to its oracle by the equivalence harness.
 *
 * It imports the two work-RAM names it reads (both confirmed in ram.js):
 * MARIO_CLIMB_LIMIT_B (0x621C) and MARIO_Y (0x6205). The other two addresses it
 * touches — 0x621A (the gate it forks on) and 0x6219 (written on the nonzero arm) —
 * were BOTH examined and REJECTED for naming in ram.js: 0x621A is a
 * "broken-ladder"-looking flag that is ALSO written by an unrelated object arm
 * (ROM 0x2236/0x223F), a shared byte no single board can settle; 0x6219 is a climb
 * toggle with two writers and ZERO absolute reads. So both stay hex here, with a
 * comment, exactly as the oracle leaves them.
 */

import { MARIO_CLIMB_LIMIT_B, MARIO_Y } from "./ram.js";

/**
 * loc_1d76 -- TIMER-RUNNING branch of the climb-animation stepper: the 0x621A gate
 * decides whether to tick the sub-step timer or hold.  [ROM 0x1D76-0x1D89, falls
 * into the shared tail entry_1d8a at 0x1D8A]
 *
 *   1d76  3a 1a 62     ld   a,(0x621a)    ; A = gate byte (0x621A -- stays hex, shared)
 *   1d79  a7           and  a             ; Z := (gate == 0)
 *   1d7a  ca 8a 1d     jp   z,0x1d8a      ; gate 0 -> just tick the timer (tail entry_1d8a)
 *   1d7d  32 19 62     ld   (0x6219),a    ; else stash the gate value (0x6219 -- hex, no readers)
 *   1d80  3a 1c 62     ld   a,(0x621c)    ; A = MARIO_CLIMB_LIMIT_B
 *   1d83  d6 13        sub  0x13          ; A = limit - 0x13
 *   1d85  21 05 62     ld   hl,0x6205     ; HL -> MARIO_Y
 *   1d88  be           cp   (hl)          ; carry := (limit-0x13) < MARIO_Y
 *   1d89  d0           ret  nc            ; limit-0x13 >= MARIO_Y -> HOLD (return to caller)
 *   1d8a  ...          ; else FALL INTO entry_1d8a: dec (0x620F) ; ret
 *
 * WHAT IT DOES. entry_1d03 (and its twin loc_1cf2) jumps here when the walk/climb
 * sub-step timer 0x620F (MARIO_MOVE_STEP_TIMER) is still running -- i.e. a 1px
 * shift is mid-stride. loc_1d76 decides whether to advance that timer this frame:
 *   - GATE == 0 (arm Z, the ONLY arm reached in attract -- 46/46, see below):
 *     jump straight to entry_1d8a, which decrements 0x620F and returns. loc_1d76
 *     writes NO memory of its own on this arm.
 *   - GATE != 0 (arms NC / C): first stash the gate value into 0x6219 (a
 *     write-only climb toggle), then test the current climb extent: compute
 *     MARIO_CLIMB_LIMIT_B - 0x13 and compare it against MARIO_Y.
 *       * NC (limit-0x13 >= MARIO_Y): HOLD -- ret to the caller WITHOUT ticking
 *         the timer (Mario is at/over the extent boundary this stride).
 *       * C  (limit-0x13 <  MARIO_Y): fall into entry_1d8a and tick the timer.
 * Both timer-ticking exits are TAIL transfers (no push): the jp z and the
 * fall-through both hand off to entry_1d8a, whose own `ret` returns to loc_1d76's
 * caller -- hence `return m.call(0x1d8a)`. The NC arm returns directly via `m.ret`.
 *
 * INPUTS  : RAM 0x621A (the gate/fork), 0x621C (MARIO_CLIMB_LIMIT_B), 0x6205
 *           (MARIO_Y). The stack (a caller return address -- for entry_1d8a's `ret`
 *           on the Z/C arms, and for the NC arm's own `ret nc`).
 * OUTPUTS : arm Z -> no own RAM write; A := 0 (gate), F from `and a`, then
 *           entry_1d8a's full effect (0x620F -= 1) + PC/SP via the tail call.
 *           arms NC/C -> 0x6219 := gate value; A := (MARIO_CLIMB_LIMIT_B - 0x13);
 *           HL := 0x6205; F from `cp (hl)`. NC returns to the caller (SP += 2);
 *           C additionally runs entry_1d8a (0x620F -= 1). loc_1d76's OWN work-RAM
 *           write is 0x6219 on the NZ arms only; NO hardware latch anywhere.
 *
 * FLAGS -- every flag-writer is KEPT verbatim; none is droppable-and-dropped here,
 * so there is zero flag-drop risk:
 *   - `and a` is the arm-Z branch condition (Z) AND it leaves A = the gate value,
 *     which the NZ arms store into 0x6219 -- both load-bearing, kept.
 *   - `sub 0x13` is kept verbatim for its RESULT (A, the compare's left operand);
 *     its FLAGS are dead -- the following `ld hl` is flag-neutral and `cp (hl)`
 *     overwrites F completely before anything reads it -- but keeping the op costs
 *     nothing and stays faithful, so it is not split into a flagless subtract.
 *   - `cp (hl)` is the `ret nc` branch condition (carry) AND the last flag-writer
 *     before every exit, so keeping it makes the F handoff bit-identical for free.
 * The unit gate compares the whole register file incl. F/F3/F5. The win here is
 * names (MARIO_CLIMB_LIMIT_B / MARIO_Y), the Z/NC/C arm structure, the docstring,
 * and the cycle collapse -- not dropped register churn.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, EXACT per-arm totals (the decompiler-pipeline doc).
 * There is NO hardware-latch write (0x6219 and, in entry_1d8a, 0x620F are work RAM)
 * and NO mid-body real call, so no bus-cycle boundary is pinned inside a fold and no
 * push16 is elided. The two tail transfers keep their `m.call(0x1d8a)` verbatim; the
 * NC arm keeps its `m.ret` verbatim. Blocks (BB0 = ld a(13) + and a(4) = 17 t):
 *   - arm Z  (gate==0):      BB0(17) + jp z taken(10)                         = 27 t -> entry_1d8a.
 *   - NZ straight line:      BB0(17) + jp z NT(10) + ld (0x6219),a(13)
 *                            + ld a,(0x621c)(13) + sub 0x13(7) + ld hl(10)
 *                            + cp (hl)(7)                                      = 77 t, PC 0x1D89.
 *   - arm NC (limit>=Y):     [NZ 77] + ret nc taken(11)                       = 88 t -> caller.
 *   - arm C  (limit< Y):     [NZ 77] + ret nc NT(5)                           = 82 t -> entry_1d8a.
 * Each equals the oracle's per-arm sum exactly, so the frame's cycle budget --
 * hence the main-loop spin count 0x6019/SPIN_COUNT (the PRNG entropy) -- is
 * unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED; why the collapse is licensed under the STRICT
 * gate). loc_1d76 is tail-called from entry_1d03's "timer running" arm (jp nz,0x1d76),
 * inside the per-frame movement cascade. Probed over 1200 attract frames: 46 entries
 * (first ~frame 842), and EVERY one takes arm Z (gate 0x621A == 0) -- the NZ arms are
 * NOT reached naturally on this trajectory, so they get crafted-entry coverage with
 * cycle-total teeth (the decompiler-pipeline doc full-branch). It is ATOMIC: all 46 entries occur with
 * io.nmiMask CLEARED -- inside the vblank NMI, whose handler zeroed the mask on entry
 * so it cannot re-enter (46/46 in-NMI) -- and the NMI's pushed PC NEVER lands in
 * [0x1D76,0x1D8A) (0 landings over 1994 NMIs). So an atomic collapse pushes no
 * mistimed PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate
 * directly -- NOT the convergent gate. See equivalence-1d76.test.js.
 */
export function loc_1d76(m) {
  const { regs, mem } = m;

  // BB0: ld a,(0x621a) ; and a  -> A = gate value, Z := (gate == 0).
  regs.a = mem.read8(0x621a); // 0x621A -- gate byte (stays hex: shared with an object arm)
  regs.and(regs.a); // A unchanged; Z := (gate == 0)

  if (regs.fZ) {
    // arm Z: gate 0 -> just tick the sub-step timer (entry_1d8a decs 0x620F).
    m.step(0x1d8a, 27); // BB0(17) + jp z taken(10)
    return m.call(0x1d8a);
  }

  // NZ arms: stash the gate value, then test the climb extent against MARIO_Y.
  mem.write8(0x6219, regs.a); // 0x6219 -- write-only climb toggle (stays hex)
  regs.a = mem.read8(MARIO_CLIMB_LIMIT_B); // 0x621C
  regs.sub(0x13); // A = limit - 0x13 (flags dead -- overwritten by the cp below)
  regs.hl = MARIO_Y; // 0x6205
  regs.cp(mem.read8(regs.hl)); // carry := (limit-0x13) < MARIO_Y
  m.step(0x1d89, 77); // BB0(17) + jp z NT(10) + ld(0x6219)(13) + ld a(0x621c)(13) + sub(7) + ld hl(10) + cp(hl)(7)

  if (regs.fNC) {
    // arm NC: limit-0x13 >= MARIO_Y -> HOLD, return to the caller without ticking.
    m.ret(11); // ret nc taken
    return;
  }

  // arm C: limit-0x13 < MARIO_Y -> fall into entry_1d8a and tick the timer.
  m.step(0x1d8a, 5); // ret nc not taken
  return m.call(0x1d8a);
}
