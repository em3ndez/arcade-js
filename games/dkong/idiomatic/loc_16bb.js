// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16bb — every frame, clear object #1's reversal flag, then route the moving sprite group
 * to bounce/slide/hand-off by its position and travel direction.  ROM 0x16BB.
 *
 * The first-stage dispatcher of the loc_16bb / loc_16e1 pair that walks a horizontally-moving
 * group of 10 sprites back and forth between the 0x5A / 0x5D rails (its motion tail is the
 * shared loc_16d5 group-slide). It runs first every frame and does two things:
 *
 *   1. Clear object #1's even-frame countdown M50_OBJ1_REVERSE_TIMER (0x62A0) := 0. This is
 *      the "keep travelling" default: loc_2602 will let this wrap to 0xFF and hold the
 *      current direction. Only the
 *      loc_16d0 arm overwrites it with 1 to make it underflow immediately and REVERSE — so
 *      pre-clearing here is what makes "did we choose loc_16d0?" the whole bounce decision.
 *
 *   2. Read record #2's X (recordX, 0x6910) and object #1's published signed per-frame step
 *      (stepByte, 0x63A3), and route:
 *        - recordX at/above the rail region (>= 90): the group has climbed to the rail — hand
 *          to loc_16e1, the second-stage dispatcher that decides reinit-vs-bounce at the 93
 *          threshold.
 *        - recordX below the rail region (< 90), step NEGATIVE (heading further into the near
 *          edge): schedule a reversal and slide this frame — loc_16d0 (bounce).
 *        - recordX below the rail region, step POSITIVE (heading away from the near edge): just
 *          slide this frame — loc_16d5.
 *
 * The below-rail sign-to-outcome mapping here is the mirror of loc_16e1's at-rail mapping;
 * together the two dispatchers are the bounce — a reversal is scheduled only while the group is
 * still travelling INTO the edge nearest it. loc_16bb's only memory write of its own is the
 * M50_OBJ1_REVERSE_TIMER (0x62A0) clear; the chosen handler does all the motion work.
 *
 * The M50_* names in ram.js place this family on the 50m board (board-2 object cascade), but
 * the VISUAL scene these sprites depict is still UNCONFIRMED: the motion tails loc_16d0 /
 * loc_16d5 and their meaning-bearing callee loc_2602 all declined an English name over the
 * sprite-record trap, and this routine's rail thresholds sit in still-unnamed engine scratch
 * (0x63A3 / 0x6910) — so it keeps the neutral loc_16bb name and states the mechanic in prose,
 * matching its family. A reviewer who promotes loc_2602 can promote this whole family in the
 * same pass.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16bb.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16bb (0×/2500 frames, asserted — the
 *           object cascade this family drives runs only in real gameplay), so all three routes
 *           are reproduced by poking recordX / stepByte (and the object's motion state) on a
 *           booted machine and comparing RAM − STACK_SCRATCH + pc + SP against the oracle. A
 *           full recordX sweep pins the exact 90 hand-off threshold and the below-rail sign
 *           split; a FRAME sweep drives the real motion through the bounce arms. Teeth: a
 *           swapped-sign twin (bounces on the wrong step sign) and a dropped-clear twin (skips
 *           the M50_OBJ1_REVERSE_TIMER (0x62A0) := 0 pre-clear), both caught by the RAM diff.
 * LIVE-OUT: memory-only. loc_16bb tail-returns through whichever handler it picks; the whole
 *           family is dispatched from the in-game substate table and returns through the NMI
 *           dispatcher, which reads no register or flag it leaves — the register file is dead
 *           ABI. RAM (+ SP/pc) backstops that.
 * NAMES:    M50_OBJ1_REVERSE_TIMER (0x62A0, object #1's even-frame countdown) from ram.js.
 *           0x63A3 (object #1's published signed step) and 0x6910 (a SPRITE_BUFFER record's
 *           X) are not individually named in ram.js — kept hex, described in prose to match
 *           loc_16d5 / loc_16e1. The 90 / 93 rail thresholds are kept in prose.
 */

import { M50_OBJ1_REVERSE_TIMER } from "./ram.js";
import { loc_16d0 } from "./loc_16d0.js"; // ROM 0x16D0 — schedule a reversal, then slide (bounce)
import { loc_16d5 } from "./loc_16d5.js"; // ROM 0x16D5 — the shared group-slide motion tick
import { loc_16e1 } from "./loc_16e1.js"; // ROM 0x16E1 — the at-rail reinit/bounce dispatcher

export function loc_16bb(m) {
  const { mem } = m;

  // Clear object #1's even-frame countdown — the "keep travelling" default. Only loc_16d0
  // overwrites it (with 1) to schedule a reversal, so pre-clearing makes the arm choice the
  // whole bounce decision. (The oracle's `xor a` / `ld (0x62A0),a`; A is dead into every arm.)
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x00);

  // The published signed per-frame step and record #2's X — the routing inputs.
  const stepByte = mem.read8(0x63a3);
  const recordX = mem.read8(0x6910);

  // At/above the rail region: the group has climbed to the rail — hand to the second-stage
  // dispatcher (which decides reinit vs bounce at the 93 threshold), passing the same inputs.
  if (recordX >= 90) {
    loc_16e1(m, recordX, stepByte);
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
    loc_16d5(m);
  }
}
