// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16d0 — arm object #1's countdown to expire next even frame (reverse), then slide the group.  ROM 0x16D0.
 *
 * One of two entry variants of the stepKongWalk group-slide tail, in the dispatchKongWalkFrame / loc_16d0 /
 * endKongWalkAndAdvanceInterlude substate family that walks a horizontally-moving group of 10 sprites back and
 * forth. The dispatcher dispatchKongWalkFrame runs first every frame: it CLEARS object #1's even-frame
 * countdown (M50_OBJ1_REVERSE_TIMER := 0), reads record #2's X (0x6910) and the object's step sign
 * (bit 7 of 0x63A3), and routes to a tail by whether the group has reached the edge it is
 * currently moving toward (X vs the 0x5A / 0x5D rails). loc_16d0 is the "hit the boundary"
 * arm:
 *
 *   1. Set object #1's countdown M50_OBJ1_REVERSE_TIMER := 1. Because loc_2602 decrements this
 *      on the next EVEN frame, a value of 1 makes it underflow immediately — which is exactly
 *      the event loc_2602 turns into "reload the period (0x80) and REVERSE the step-direction
 *      sign at M50_OBJ1_STEP_DIR (0x62A1)". So writing 1 here schedules a direction reversal for
 *      the next tick: the group bounces off the edge. (The plain stepKongWalk arm leaves
 *      M50_OBJ1_REVERSE_TIMER at the 0 the dispatcher pre-set, so its countdown wraps to 0xFF
 *      and the group keeps travelling.)
 *
 *   2. Fall straight into stepKongWalk to run THIS frame's motion tick — advance object #1 and
 *      shift the whole 10-record sprite-object block one step along X.
 *
 * The oracle loads A=1 and stores A to 0x62A0; that A is dead the instant it is stored
 * (stepKongWalk → loc_2602 reads FRAME, not A), so the store is expressed directly as a memory
 * write with no register plumbing. Not a leaf: it tail-calls stepKongWalk (0x16d5, already
 * idiomatic), which drives loc_2602 + addStrided. The on-screen object/scene is UNCONFIRMED
 * — stepKongWalk and loc_2602 both declined an English name over the sprite-record trap (the
 * 50m-object cells 0x62A0/0x62A1 are now named M50_OBJ1_REVERSE_TIMER/M50_OBJ1_STEP_DIR in
 * ram.js at [code] confidence, but WHAT they animate is not settled) — so this routine keeps
 * the neutral loc_16d0 name and describes the mechanic in prose; a reviewer who promotes
 * loc_2602 can promote this in the same pass.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16d0.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16d0 (0× / 2500 frames, asserted — the
 *           sub_25f2 object cascade this family drives runs only in real gameplay), so real
 *           states are reproduced by pokes on a booted machine: a 256-value FRAME sweep
 *           (even → the write-1 countdown underflows → reload+reverse; odd → publish ±1 →
 *           block shift), a block-X wrap sweep on both step signs through addStrided, and a
 *           direction sweep exercising reverseStepDirection's both arms. Teeth: a
 *           skip-the-write twin (behaves like stepKongWalk) and a wrong-value twin (writes 0),
 *           both caught by the RAM diff.
 * LIVE-OUT: memory-only. loc_16d0 tail-returns through stepKongWalk; the whole family is
 *           dispatched from the in-game substate table (0x0702) and returns through the NMI
 *           dispatcher, which reads no register or flag it leaves — A/B/C/DE/HL are dead ABI.
 *           The RAM diff (+ SP/pc) backstops that.
 * NAMES:    M50_OBJ1_REVERSE_TIMER (0x62A0) — object #1's even-frame reversal countdown — and
 *           M50_OBJ1_STEP_DIR (0x62A1) from ram.js (matching loc_2602). SPRITE_OBJ_BLOCK and
 *           the rest live inside stepKongWalk.
 */

import { stepKongWalk } from "./stepKongWalk.js"; // ROM 0x16D5 — the shared group-slide motion tick
import { M50_OBJ1_REVERSE_TIMER } from "./ram.js";

export function loc_16d0(m) {
  const { mem } = m;

  // Arm object #1's countdown to underflow on the next even frame -> loc_2602 reloads the
  // period and reverses the group's step direction. (The oracle's `ld a,1` / `ld (0x62A0),a`;
  // A is dead past the store, so no register is set.)
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x01);

  // Fall through to the shared motion tick (advance object #1, slide the 10-record block).
  stepKongWalk(m);
}
