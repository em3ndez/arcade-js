// SPDX-License-Identifier: GPL-3.0-only
/**
 * service75mBoard — the 75m per-frame service router. A board gate opens it only on board 3.
 * When open it routes on MARIO_Y and a level-scaled cadence: MARIO_Y >= 240 (bottom of the
 * screen, larger Y is lower) kills Mario; otherwise it services board objects and the
 * vertical-reposition machine on a frame-keyed cadence that doubles after level 1 (the test
 * is LEVEL != 1, so level 0 takes the fast cadence too). Level 1 idles two frames in four.
 *
 * LIVE-OUT: memory-only — whatever the dispatched continuation writes.
 */

import { MARIO_Y, LEVEL, FRAME } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";
import { serviceBoardObjects } from "./serviceBoardObjects.js";
import { loc_271e } from "./loc_271e.js";

const BOARD_MASK = 0x04; // bit2 selects board 3
const OFF_TRACK_Y = 240; // MARIO_Y at/above this is the bottom of the screen (no X band)

export function service75mBoard(m) {
  const { regs, mem8 } = m;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  if (mem8[MARIO_Y] >= OFF_TRACK_Y) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  const level = mem8[LEVEL];
  const frame = mem8[FRAME];

  if (level !== 1) {
    // Fast cadence (any LEVEL != 1): objects on odd frames, reposition on even frames.
    if ((frame & 1) !== 0) {
      serviceBoardObjects(m);
      return;
    }
    loc_271e(m);
    return;
  }

  // Level 1 slow cadence: one quarter of frames each, the other two idle.
  const phase = frame & 3;
  if (phase === 1) {
    loc_271e(m);
    return;
  }
  if (phase === 0) {
    serviceBoardObjects(m);
    return;
  }
}
