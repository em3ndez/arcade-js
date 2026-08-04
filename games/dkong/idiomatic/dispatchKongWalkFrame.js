// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchKongWalkFrame — every frame, clear object #1's reversal flag, then route the moving
 * sprite group to bounce, slide or hand-off by its position and travel direction.
 *
 * The first-stage dispatcher for a horizontally-moving group of 10 sprites that walks back and
 * forth between two rails. It runs first every frame and does two things:
 *
 *   1. Clear object #1's even-frame countdown, M50_OBJ1_REVERSE_TIMER. This is the "keep
 *      travelling" default: on an even frame the motion tick decrements it from 0 to 0xFF, which is
 *      non-zero, so no reversal is taken and the current direction holds. Only the bounce arm
 *      overwrites it with 1, so that the same decrement lands on ZERO — the case that reloads the
 *      period and REVERSES — in that very frame. That write survives only on an even frame,
 *      because on an odd one the motion tick skips its decrement and this clear wipes the write
 *      next frame. Pre-clearing here is what makes the choice of arm the whole bounce decision.
 *
 *   2. Read record #2's X out of the sprite-object block and object #1's published signed
 *      per-frame step (M50_OBJ1_STEP), and route:
 *        - X at or above the rail region (>= 90): the group has climbed to the rail — hand to the
 *          second-stage dispatcher, which decides reinitialise-versus-bounce at the 93 threshold.
 *        - X below the rail region, step NEGATIVE (heading further into the near edge): schedule a
 *          reversal and slide this frame — the bounce.
 *        - X below the rail region, step POSITIVE (heading away from the near edge): just slide.
 *
 * The below-rail sign-to-outcome mapping here mirrors the second-stage dispatcher's at-rail
 * mapping; together the two are the bounce — a reversal is scheduled only while the group is still
 * travelling INTO the edge nearest it. This routine's only memory write of its own is the
 * reverse-timer clear; the chosen handler does all the motion work.
 *
 * WHAT THE NAME DOES NOT CLAIM: that the walking figure is Kong on measured bytes. "Kong" is a
 * reading of what the interlude looks like on screen, not a byte measurement. The rail thresholds
 * stay raw magnitudes rather than named state — the step input IS named, the record's X byte is
 * not — so the mechanic is stated in prose.
 *
 * LIVE-OUT: memory-only. Control tail-returns through whichever handler is picked, and up into the
 * interrupt dispatcher, which reads no register or flag left behind.
 */

import { M50_OBJ1_REVERSE_TIMER, M50_OBJ1_STEP } from "./names.js";
import { loc_16d0 } from "./loc_16d0.js";
import { stepKongWalk } from "./stepKongWalk.js";
import { endKongWalkAndAdvanceInterlude } from "./endKongWalkAndAdvanceInterlude.js";

export function dispatchKongWalkFrame(m) {
  const { mem } = m;

  // Clear object #1's even-frame countdown — the "keep travelling" default. Only the bounce arm
  // overwrites it (with 1) to schedule a reversal, so pre-clearing makes the arm choice the whole
  // bounce decision. The accumulator this leaves behind is dead into every arm.
  mem.write8(M50_OBJ1_REVERSE_TIMER, 0x00);

  // The published signed per-frame step and record #2's X — the routing inputs.
  const stepByte = mem.read8(M50_OBJ1_STEP);
  const recordX = mem.read8(0x6910);

  // At or above the rail region: the group has climbed to the rail — hand to the second-stage
  // dispatcher, which decides reinitialise versus bounce, passing the same inputs.
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
