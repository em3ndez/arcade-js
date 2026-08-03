// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bf2 — the airborne handler's leftward-nudge arm: stamp the left drift and pose when
 * the position gate raises its left verdict, otherwise leave the jump untouched.  ROM 0x1BF2.
 *
 * Reached by a tail branch from the airborne handler advanceMarioAirborneFrame. By the time control arrives,
 * that handler has snapshotted Mario's pre-motion X/Y into MARIO_AIR_PREV_X / MARIO_AIR_PREV_Y,
 * run one ballistic integration step, and asked the position gate loc_241f for its verdict — a
 * two-flag pair of which at most one half is ever raised. advanceMarioAirborneFrame consumed the RIGHT half
 * itself (writing the mirror-image +0x0080 drift and setting the facing bit); it branches here
 * with the LEFT half still sitting in the register bank, which is the only thing this routine
 * decides on.
 *
 *   - Verdict NOT raised — the gate wants no horizontal nudge. Nothing about the jump
 *     changes: the routine hands straight on to the airborne dispatch at 0x1C05, leaving the
 *     velocity, the pose AND the current ballistic arc exactly as they were. This is the arm
 *     plain attract always takes — all 360 of its real dispatches.
 *
 *   - Verdict raised — loc_241f raises it on exactly one exit, Mario's X at or past the
 *     right-hand screen limit (0xEA), so this is the "he has run out of screen on the right"
 *     case. Two cells are stamped, and nothing else:
 *       * MARIO_AIR_VX_HI:MARIO_AIR_VX_LO := 0xFF80 — the signed 16-bit −0x0080, half a pixel
 *         per frame leftward. Same magnitude, opposite sign to the +0x0080 the sibling
 *         right-verdict arm writes, and to the leftward launch velocity launchMarioJump
 *         commits at jump-init.
 *       * MARIO_SPRITE_CODE's facing bit (bit 7, the horizontal flip; 1 = facing right) is
 *         CLEARED, turning Mario to face the way he is now being pushed. The pose bits below
 *         it are read back and preserved — this is a bit clear, not a store.
 *     Control then continues into reverseMarioVerticalArc, which re-bases the ballistic arc at Mario's
 *     present position before rejoining the same 0x1C05 dispatch the other arm went to
 *     directly. So the two halves of the reflection are split across the two routines: the
 *     horizontal half here, the vertical half in reverseMarioVerticalArc.
 *
 * REGISTER BOUNDARY. The verdict is read out of the register bank rather than taken as a
 * parameter, because that is how BOTH callers hand it over: the frozen oracle at ROM 0x1BB2
 * leaves it there, and the idiomatic advanceMarioAirborneFrame gets it from loc_241f, which mirrors its honest
 * {d, e} return into the same registers for exactly this reason. Promoting it to a parameter
 * is a two-file ABI change and belongs to a clarify pass, not here.
 *
 * The context-block base register is pinned to Mario's block (base MARIO_ACTIVE) by the sole
 * entry — advanceMarioAirborneFrame loads it and nothing between there and here writes it — which is what lets
 * this routine's own three cells be named outright instead of reached as record offsets; all
 * 360 real attract dispatches confirm the pinned base, and reverseMarioVerticalArc's fixed-point leaf still
 * reads Mario's record through it. The tail's return value is forwarded unchanged, because the
 * airborne cascade above uses it for the caller-skip convention.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1bf2.test.js.
 * GATE:     captured + captured-under-control-poke + exhaustive. 360 REAL attract dispatches
 *           carry the not-raised arm — the only one plain attract ever reaches, since the demo
 *           never gets Mario airborne past the right-hand limit; a 120-dispatch sample is
 *           replayed in full and the verdict/base tally covers all 360. The raised arm is NOT
 *           dead code and is not left to fabrication: holding MARIO_X past the gate's 0xEA
 *           limit in an otherwise-untouched attract run makes the real ROM take it 2713 times,
 *           and those real poked-run dispatches are captured and replayed as their own suite.
 *           On top of both, the verdict register is swept EXHAUSTIVELY over all 256 values from
 *           a real captured base, crossed with the facing bit set/clear and with
 *           MARIO_FATAL_FALL 0/1 so both of reverseMarioVerticalArc's own arms run — 1024 cases. Every case
 *           compares RAM − STACK_SCRATCH, pc, SP and the forwarded return value, and the whole
 *           chain below runs on both sides. Teeth: five broken twins, two of which are
 *           deliberately INVISIBLE to the captured suites (a verdict test that accepts any
 *           nonzero value, and a dropped facing-bit clear) so the exhaustive sweep is proved
 *           load-bearing rather than decorative.
 * LIVE-OUT: memory-only, plus the tail's forwarded return value. The verdict register and the
 *           flags of the oracle's decrement are dead past the branch: on BOTH tails the next
 *           routine to look at that register pair is the tile classifier at 0x2B9B, whose
 *           `pop de` overwrites the pair outright, and every flag consumer downstream (0x1BDC,
 *           0x2B2D) sets the flags itself first. No pose or velocity value survives in a
 *           register — everything this routine decides is written to RAM.
 * NAMES:    MARIO_AIR_VX_HI (0x6210), MARIO_AIR_VX_LO (0x6211), MARIO_SPRITE_CODE (0x6207)
 *           imported from ram.js; MARIO_ACTIVE, MARIO_X, MARIO_AIR_PREV_X/_Y and
 *           MARIO_FATAL_FALL named in the prose above. reverseMarioVerticalArc (ROM 0x1BD8) is direct-called;
 *           0x1C05 has no idiomatic twin in ROUTINES yet, so that tail stays a registry call.
 */

import { MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_SPRITE_CODE } from "./ram.js";
import { reverseMarioVerticalArc } from "./reverseMarioVerticalArc.js"; // ROM 0x1BD8

/** Horizontal-flip / facing bit of MARIO_SPRITE_CODE (1 = facing right). */
const FACING_BIT = 0x80;

/** Leftward airborne drift, signed 16-bit −0x0080 = half a pixel per frame. */
const DRIFT_LEFT_HI = 0xff;
const DRIFT_LEFT_LO = 0x80;

export function loc_1bf2(m) {
  const { regs, mem } = m;

  // The gate's leftward verdict, handed over in the register bank. It is raised only for
  // Mario past the right-hand screen limit; every other verdict leaves the jump alone.
  if (regs.e !== 1) {
    return m.call(0x1c05); // straight on to the airborne dispatch — velocity and arc untouched
  }

  // Push him back inboard at half a pixel per frame, and turn him to face that way.
  mem.write8(MARIO_AIR_VX_HI, DRIFT_LEFT_HI);
  mem.write8(MARIO_AIR_VX_LO, DRIFT_LEFT_LO);
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) & ~FACING_BIT);

  // The vertical half of the same reflection: re-base the arc at Mario's present position,
  // then on into the shared airborne dispatch.
  return reverseMarioVerticalArc(m);
}
