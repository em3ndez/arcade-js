// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchKongWalkFrame — every frame, clear object #1's reversal flag, then route the moving sprite group
 * to bounce/slide/hand-off by its position and travel direction.  ROM 0x16BB.
 *
 * The first-stage dispatcher of the dispatchKongWalkFrame / endKongWalkAndAdvanceInterlude pair that walks a horizontally-moving
 * group of 10 sprites back and forth between the 0x5A / 0x5D rails (its motion tail is the
 * shared stepKongWalk group-slide). It runs first every frame and does two things:
 *
 *   1. Clear object #1's even-frame countdown M50_OBJ1_REVERSE_TIMER (0x62A0) := 0. This is
 *      the "keep travelling" default: on an even frame loc_2602's `dec` takes it 0 -> 0xFF,
 *      which is non-zero, so no reversal is taken and the current direction holds. Only the
 *      loc_16d0 arm overwrites it with 1, so that the same `dec` lands on ZERO — the case that
 *      reloads the period and REVERSES — in that very frame; that write survives only on an even
 *      frame, because on an odd one loc_2602 skips the tick and this clear wipes it next frame.
 *      Pre-clearing here is what makes "did we choose loc_16d0?" the whole bounce decision.
 *
 *   2. Read record #2's X (recordX, 0x6910 — not named in ram.js) and object #1's published
 *      signed per-frame step (stepByte, M50_OBJ1_STEP), and route:
 *        - recordX at/above the rail region (>= 90): the group has climbed to the rail — hand
 *          to endKongWalkAndAdvanceInterlude, the second-stage dispatcher that decides reinit-vs-bounce at the 93
 *          threshold.
 *        - recordX below the rail region (< 90), step NEGATIVE (heading further into the near
 *          edge): schedule a reversal and slide this frame — loc_16d0 (bounce).
 *        - recordX below the rail region, step POSITIVE (heading away from the near edge): just
 *          slide this frame — stepKongWalk.
 *
 * The below-rail sign-to-outcome mapping here is the mirror of endKongWalkAndAdvanceInterlude's at-rail mapping;
 * together the two dispatchers are the bounce — a reversal is scheduled only while the group is
 * still travelling INTO the edge nearest it. dispatchKongWalkFrame's only memory write of its own is the
 * M50_OBJ1_REVERSE_TIMER (0x62A0) clear; the chosen handler does all the motion work.
 *
 * The M50_* names in ram.js place this family on the 50m board (board-2 object cascade), and the
 * group it routes is the ten-record figure the previous sequence step stamps:
 * begin50mKongRecaptureInterlude (ROM 0x16A3) copies the ROM 0x385C template into
 * SPRITE_OBJ_BLOCK and bumps the 0x6388 selector to this routine, and record #2's X (0x6910)
 * that this routine reads is a byte of that same block.
 *
 * NAME: promoted from loc_16bb in this pass, taking the scene from that opener rather than from
 * anything measured in this routine.
 * WHAT THIS NAME DOES NOT CLAIM: that the figure is Kong on measured bytes — "Kong" is the
 * pass-14 snapshot reading both interlude openers flag as a reading, not a byte measurement. The
 * rail thresholds here stay raw magnitudes rather than named state (the step input IS named —
 * M50_OBJ1_STEP — but 0x6910 is not), so the mechanic is stated in prose. loc_16d0 and loc_2602
 * are still loc_-named.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16bb.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16bb (0×/2500 frames, asserted — attract
 *           never reaches GAME_SUBSTATE 0x16 at all, because it never completes a board, and
 *           0x16bb's only ROM reference is that sub-state's 50m step table), so all three routes
 *           are reproduced by poking recordX / stepByte (and the object's motion state) on a
 *           booted machine and comparing RAM − STACK_SCRATCH + pc + SP against the oracle. A
 *           full recordX sweep pins the exact 90 hand-off threshold and the below-rail sign
 *           split; a FRAME sweep drives the real motion through the bounce arms. Teeth: a
 *           swapped-sign twin (bounces on the wrong step sign) and a dropped-clear twin (skips
 *           the M50_OBJ1_REVERSE_TIMER (0x62A0) := 0 pre-clear), both caught by the RAM diff.
 * LIVE-OUT: memory-only. dispatchKongWalkFrame tail-returns through whichever handler it picks;
 *           the whole family sits TWO levels below the in-game sub-state table — 0x0702 idx 0x16
 *           -> 0x1615 (dispatchBoardClearedInterlude), which vectors BOARD_ADVANCE_STEP through
 *           the 50m step table at ROM 0x1637, whose idx 1 (the word at 0x1639) is 0x16BB. That
 *           table entry is 0x16BB's ONLY reference anywhere in maincpu.bin (exhaustively
 *           scanned). It returns through the NMI dispatcher, which reads no register or flag it
 *           leaves — the register file is dead ABI. RAM (+ SP/pc) backstops that.
 * NAMES:    M50_OBJ1_REVERSE_TIMER (0x62A0, object #1's even-frame countdown) and
 *           M50_OBJ1_STEP (0x63A3, object #1's published signed per-frame step), both from
 *           ram.js. 0x6910 (a SPRITE_BUFFER record's X) is NOT individually named in ram.js —
 *           kept hex, described in prose to match stepKongWalk / endKongWalkAndAdvanceInterlude. The 90 / 93 rail
 *           thresholds are raw magnitudes and stay in prose.
 */

import { M50_OBJ1_REVERSE_TIMER, M50_OBJ1_STEP } from "./ram.js";
import { loc_16d0 } from "./loc_16d0.js"; // ROM 0x16D0 — schedule a reversal, then slide (bounce)
import { stepKongWalk } from "./stepKongWalk.js"; // ROM 0x16D5 — the shared group-slide motion tick
import { endKongWalkAndAdvanceInterlude } from "./endKongWalkAndAdvanceInterlude.js"; // ROM 0x16E1 — the at-rail reinit/bounce dispatcher

export function dispatchKongWalkFrame(m) {
  const { mem } = m;

  // Clear object #1's even-frame countdown — the "keep travelling" default. Only loc_16d0
  // overwrites it (with 1) to schedule a reversal, so pre-clearing makes the arm choice the
  // whole bounce decision. (The oracle's `xor a` / `ld (0x62A0),a`; A is dead into every arm.)
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x00);

  // The published signed per-frame step and record #2's X — the routing inputs.
  const stepByte = mem.read8(M50_OBJ1_STEP);
  const recordX = mem.read8(0x6910);

  // At/above the rail region: the group has climbed to the rail — hand to the second-stage
  // dispatcher (which decides reinit vs bounce at the 93 threshold), passing the same inputs.
  if (recordX >= 90) {
    endKongWalkAndAdvanceInterlude(m, recordX, stepByte);
    return;
  }

  // Below the rail region: the step's sign bit (top bit) — set means heading in the negative
  // (decreasing-X) direction, toward the near edge; clear means heading away.
  const stepIsNegative = (stepByte & 0x80) !== 0;

  // Heading into the near edge -> schedule a reversal before sliding (bounce); heading away ->
  // just slide.
  if (stepIsNegative) {
    loc_16d0(m);
  } else {
    stepKongWalk(m);
  }
}
