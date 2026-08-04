// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16d0 — set object #1's countdown to 1 so an even-frame tick reverses the group, then slide it.  ROM 0x16D0.
 *
 * One of two entry variants of the stepKongWalk group-slide tail, in the dispatchKongWalkFrame / loc_16d0 /
 * endKongWalkAndAdvanceInterlude substate family that walks a horizontally-moving group of 10 sprites back and
 * forth. The dispatcher dispatchKongWalkFrame runs first every frame: it CLEARS object #1's even-frame
 * countdown (M50_OBJ1_REVERSE_TIMER := 0), reads record #2's X (0x6910) and the object's step sign
 * (bit 7 of 0x63A3), and routes to a tail by whether the group has reached the edge it is
 * currently moving toward (X vs the 0x5A / 0x5D rails). loc_16d0 is the "hit the boundary"
 * arm:
 *
 *   1. Set object #1's countdown M50_OBJ1_REVERSE_TIMER := 1, then fall straight into
 *      stepKongWalk — which calls loc_2602 IN THE SAME FRAME. loc_2602 ticks that countdown only
 *      on EVEN frames, and a `dec` from 1 gives ZERO, which is exactly the case loc_2602 turns
 *      into "reload the period (0x80) and REVERSE the step-direction sign at M50_OBJ1_STEP_DIR
 *      (0x62A1)". So this is not a schedule for a later tick:
 *        - Entered on an EVEN frame, the reversal fires in THIS frame's tick. The flipped 0x62A1
 *          is consequential downstream: loc_2602 republishes it as M50_OBJ1_STEP (0x63A3) — 0 on
 *          this even frame, then normalised to 0xFF/0x01 by its new sign on the next odd frame —
 *          which is both the amount stepKongWalk slides the block by and the byte
 *          dispatchKongWalkFrame / endKongWalkAndAdvanceInterlude route on next frame.
 *        - Entered on an ODD frame, loc_2602 skips the countdown entirely, and the next frame
 *          dispatchKongWalkFrame re-clears M50_OBJ1_REVERSE_TIMER to 0 before any arm runs.
 *          Nothing else in the ROM touches 0x62A0 — it is written only at 0x16BC and 0x16D2 and
 *          decremented only at 0x260B (verified by an exhaustive scan of maincpu.bin) — so on an
 *          odd frame this write is LOST, not deferred.
 *      (The plain stepKongWalk arm leaves M50_OBJ1_REVERSE_TIMER at the 0 the dispatcher pre-set;
 *      `dec` from 0 is the genuine underflow, 0 -> 0xFF, and 0xFF is non-zero, so no reversal is
 *      taken and the group keeps travelling.)
 *
 *   2. Fall straight into stepKongWalk to run THIS frame's motion tick — advance object #1 and
 *      shift the whole 10-record sprite-object block one step along X.
 *
 * The oracle loads A=1 and stores A to 0x62A0; that A is dead the instant it is stored
 * (stepKongWalk → loc_2602 reads FRAME, not A), so the store is expressed directly as a memory
 * write with no register plumbing. Not a leaf: it tail-calls stepKongWalk (0x16d5, already
 * idiomatic), which drives loc_2602 + addStrided. Nothing in THIS routine's own state settles
 * what is on screen — the 50m-object cells 0x62A0/0x62A1 are named M50_OBJ1_REVERSE_TIMER /
 * M50_OBJ1_STEP_DIR in names.js at [code] confidence, but WHAT they animate is not settled here,
 * and this routine adds only a one-byte reversal arming write to the shared tail — so it keeps the
 * neutral loc_16d0 name and describes the mechanic in prose. Its tail stepKongWalk (ROM 0x16D5)
 * WAS promoted in this pass, inheriting its scene from the interlude opener that stamps the
 * ten-record block it slides; loc_2602, the shared object driver, is still loc_-named.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16d0.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16d0 (0× / 2500 frames, asserted — attract
 *           never reaches GAME_SUBSTATE 0x16 at all, because it never completes a board, and this
 *           family hangs off that sub-state's 50m step table at ROM 0x1637), so real
 *           states are reproduced by pokes on a booted machine: a 256-value FRAME sweep
 *           (even → the written 1 decrements to zero → reload+reverse; odd → publish ±1 →
 *           block shift), a block-X wrap sweep on both step signs through addStrided, and a
 *           direction sweep exercising reverseStepDirection's both arms. Teeth: a
 *           skip-the-write twin (behaves like stepKongWalk) and a wrong-value twin (writes 0),
 *           both caught by the RAM diff.
 * LIVE-OUT: memory-only. loc_16d0 tail-returns through stepKongWalk; the whole family sits TWO
 *           levels below the in-game sub-state table — 0x0702 idx 0x16 -> 0x1615
 *           (dispatchBoardClearedInterlude), which vectors BOARD_ADVANCE_STEP through the 50m
 *           step table at ROM 0x1637, whose idx 1 (the word at 0x1639) is 0x16BB, and 0x16d0 is
 *           reached only by falling out of 0x16BB or by 0x16E1's `jp z`. It returns through the
 *           NMI dispatcher, which reads no register or flag it leaves — A/B/C/DE/HL are dead ABI.
 *           The RAM diff (+ SP/pc) backstops that.
 * NAMES:    M50_OBJ1_REVERSE_TIMER (0x62A0) — object #1's even-frame reversal countdown — and
 *           M50_OBJ1_STEP_DIR (0x62A1) from names.js (matching loc_2602). SPRITE_OBJ_BLOCK and
 *           the rest live inside stepKongWalk.
 */

import { stepKongWalk } from "./stepKongWalk.js"; // ROM 0x16D5 — the shared group-slide motion tick
import { M50_OBJ1_REVERSE_TIMER } from "./names.js";

export function loc_16d0(m) {
  const { mem } = m;

  // Set object #1's countdown to 1. stepKongWalk's loc_2602 call ticks it in THIS same frame
  // when the frame is even: `dec` 1 -> 0 is the zero case, so loc_2602 reloads the period (0x80)
  // and reverses the group's step direction. On an odd frame loc_2602 skips the tick and the
  // dispatcher clears this byte again next frame. (The oracle's `ld a,1` / `ld (0x62A0),a`;
  // A is dead past the store, so no register is set.)
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x01);

  // Fall through to the shared motion tick (advance object #1, slide the 10-record block).
  stepKongWalk(m);
}
