// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchMarioMovement — the movement machine's router: pick which handler owns Mario's frame.  ROM 0x1AC3.
 *
 * Run once per frame from the shared per-frame update cascade (ROM 0x197A). It writes no
 * memory of its own — it is five tests in a fixed priority order, and the order IS the
 * mechanic. The first test that fires takes the frame; nothing below it is consulted:
 *
 *   1. MARIO_AIRBORNE set  -> advanceMarioAirborneFrame. A jump or a fall owns the whole frame:
 *      the arc is integrated and steered, and no input below is looked at, which is why a
 *      jump cannot be steered onto a ladder or re-triggered in mid-air.
 *   2. MARIO_FREEZE_TIMER nonzero -> tickPostLandingFreeze. The few frames after a landing, in
 *      which Mario is unresponsive and the timer just counts down.
 *   3. MARIO_HAMMER_ACTIVE set -> loc_1ae6, the ground walk/climb direction pick. Note WHERE
 *      this enters: below the ladder test and below the jump test, so while a hammer is in
 *      Mario's hands he can only walk — the climb branch and the jump branch are both
 *      unreachable, and that is exactly the hammer's cost.
 *   4. MARIO_ON_LADDER set -> climbDownWhileHeld, the Down/Up half of the climb dispatch.
 *   5. the jump press-edge bit of P1_INPUT -> initMarioJump, which flags Mario airborne and
 *      launches the arc — so from the NEXT frame test 1 takes over.
 *   6. otherwise fall through to loc_1ae6: ordinary grounded walking (and stepping onto a
 *      ladder, which is what sets the flag test 4 reads on later frames).
 *
 * Every test is exact rather than a range: the three flag tests fire on the value 1 alone
 * (2 or 128 in MARIO_AIRBORNE would fall through to the freeze test), the freeze test fires
 * on any nonzero, and the jump test looks at the input word's top bit only. The equivalence
 * sweep drives all 256 values through each cell, so those are measured, not assumed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1ac3.test.js.
 * GATE:     captured + sweeps + crafted overlaps. NO crafting is needed for arm COVERAGE — a
 *           plain 2000-frame attract run (no coin, no pokes, no tape) dispatches 0x1AC3 1197x
 *           and those real dispatches hit ALL SIX arms (ground 670, hammer 285, airborne 167,
 *           ladder 55, freeze 16, jump 4), every one replayed oracle-vs-candidate. On top of
 *           that, five 256-value sweeps drive each selector cell over its whole range from a
 *           real grounded capture, pinning the exact predicates (the flag tests fire on 1
 *           alone, the jump test on the top bit alone) by asserting the arm histogram; and
 *           five crafted states turn two selectors on at once to pin the priority order,
 *           which the demo never exercises. Compared on RAM - STACK_SCRATCH and the return
 *           value, with each arm's whole downstream cascade running on both sides — the frozen
 *           oracle on the reference side, the idiomatic handlers plus their still-oracle
 *           remainders on this one — so a mis-routed frame shows up as divergent RAM in the
 *           handler, not here. Registers and pc/SP are NOT in the contract, and the gate
 *           MEASURES that rather than assuming it: it continues the caller's own cascade (the
 *           next four routines ROM 0x197A runs) on both machines after every one of the 1197
 *           dispatches and requires RAM to still agree, which a live register or flag would
 *           break; and it prints the measured per-arm SP residue (0 or -2 bytes, depending on
 *           whether that arm's chain ended in still-oracle code that executed the Z80 `ret` or
 *           in an idiomatic routine that returned in JS instead) while asserting the one thing
 *           the dropped stack model does claim — that both stack pointers stay inside the dead
 *           scratch region.
 *           Teeth: five broken twins — priority inverted so the freeze test outranks airborne,
 *           the hammer arm moved BELOW the jump test (so a hammer could jump), the ladder arm
 *           dropped, the jump bit read as bit 0, and the airborne test relaxed to "nonzero" —
 *           each required to be caught at a named live cell. The last of those is invisible on
 *           every real dispatch (the flag is only ever 0 or 1 in play) and is caught only by
 *           the sweep, which is the concrete reason the sweep is in the gate.
 * LIVE-OUT: memory-only. This routine writes nothing itself; every visible byte belongs to
 *           the handler it picked. The return value is compared as well and matches on every
 *           case, but it is dead too: the caller ROM 0x197A discards the result and calls the
 *           next cascade routine without reading a register or a flag. The registers that do
 *           differ are a/f/b/c/d/e/h/l, varying by arm — the airborne arm's C alone is the
 *           residue advanceMarioAirborneFrame's own gate already declares dead — and the
 *           caller-cascade continuation above is what shows none of them is read. pc/SP are
 *           the dropped stack model (see GATE).
 * NAMES:    MARIO_AIRBORNE (0x6216), MARIO_FREEZE_TIMER (0x621E), MARIO_HAMMER_ACTIVE (0x6217),
 *           MARIO_ON_LADDER (0x6215) and P1_INPUT (0x6010), all imported from ram.js. No
 *           record-offset ambiguity arises here: all five are absolute loads in the oracle, not
 *           reads through an object/sprite record pointer, so each names a fixed cell and not
 *           an offset into a block. (The oracle defines a record-offset helper off the caller's
 *           block pointer, but never uses it in this span; it hands the helper to the ground arm,
 *           which forwards it two routines deep without any of them reading it, so it is dropped
 *           here. The block pointer itself is dead on every arm — the airborne handler sets its
 *           own.) All five handlers are direct-called — advanceMarioAirborneFrame (ROM 0x1BB2),
 *           tickPostLandingFreeze (0x1B55), loc_1ae6 (0x1AE6), climbDownWhileHeld (0x1B38) and
 *           initMarioJump (0x1B6E) — so no address literal is left in the body.
 */

import {
  MARIO_AIRBORNE,
  MARIO_FREEZE_TIMER,
  MARIO_HAMMER_ACTIVE,
  MARIO_ON_LADDER,
  P1_INPUT,
} from "./ram.js";
import { advanceMarioAirborneFrame } from "./advanceMarioAirborneFrame.js"; // ROM 0x1BB2
import { tickPostLandingFreeze } from "./tickPostLandingFreeze.js"; // ROM 0x1B55
import { loc_1ae6 } from "./loc_1ae6.js"; // ROM 0x1AE6
import { climbDownWhileHeld } from "./climbDownWhileHeld.js"; // ROM 0x1B38
import { initMarioJump } from "./initMarioJump.js"; // ROM 0x1B6E

// Top bit of the cooked control word: set for exactly one frame per fresh jump-button press.
const JUMP_PRESS_EDGE = 0x80;

/**
 * @param {object} m  the machine (reads memory only; writes nothing of its own).
 * @returns {*} whatever the selected handler returns — dead; the caller discards it.
 */
export function dispatchMarioMovement(m) {
  const { mem } = m;

  // Airborne outranks everything: a jump or fall owns the frame, input included.
  if (mem.read8(MARIO_AIRBORNE) === 1) return advanceMarioAirborneFrame(m);

  // Still frozen from the last landing — tick it down and do nothing else.
  if (mem.read8(MARIO_FREEZE_TIMER) !== 0) return tickPostLandingFreeze(m);

  // Hammer in hand: walking only. Entering the ground arm here skips both the ladder
  // branch and the jump branch below.
  if (mem.read8(MARIO_HAMMER_ACTIVE) === 1) return loc_1ae6(m);

  // On a ladder: the climb dispatch owns the frame.
  if (mem.read8(MARIO_ON_LADDER) === 1) return climbDownWhileHeld(m);

  // A fresh jump press this frame: launch the arc.
  if (mem.read8(P1_INPUT) & JUMP_PRESS_EDGE) return initMarioJump(m);

  // Grounded and not jumping: ordinary walking / stepping onto a ladder.
  return loc_1ae6(m);
}
