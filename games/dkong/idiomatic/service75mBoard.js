// SPDX-License-Identifier: GPL-3.0-only
/**
 * service75mBoard — the 75m per-frame service router: the bottom-of-screen death, then a
 * LEVEL-scaled cadence over the board's object service and its vertical-reposition machine.
 *
 * Called from the board cascade. A board gate opens the whole routine only when the current
 * board's bit is set in the applicability mask below, which selects board 3; on every other
 * board the service is skipped entirely.
 *
 * When the gate opens it routes on MARIO_Y and a level-scaled cadence. There are FOUR
 * outcomes, not three — the fourth is doing nothing:
 *
 *   - If MARIO_Y is at or above 240 — larger Y is LOWER on screen, so this is Mario at the
 *     very bottom of the display — he is killed. The test is on MARIO_Y alone, with NO X-band
 *     test, so he need not be on a lift at all.
 *   - Otherwise it services on a cadence keyed to the frame counter, and the cadence doubles
 *     after the first level:
 *       - Level 1, the slow cadence: on one frame in four advance and spawn the board
 *         objects; on the next run the vertical-reposition machine; on the other two frames
 *         it idles — and that idle is the fourth outcome.
 *       - Every OTHER level, the fast cadence: every odd frame advance and spawn the objects,
 *         every even frame run the reposition machine, so there is no idle phase.
 *   So the objects and the reposition step run twice as often from level 2 on — the
 *   difficulty ramp for this board. The test is LEVEL != 1, NOT "LEVEL >= 2": level 0 takes
 *   the fast cadence too. Nothing in this routine bounds LEVEL from below.
 *
 * The reads happen in order — MARIO_Y first, since its bottom-of-screen test can
 * short-circuit before the level and frame are ever read, then the level, then the frame.
 *
 * The name says which BOARD's per-frame service this is, not what the board contains. What
 * it refuses is "Lift": this router also runs the board's spawn/animate pass and the
 * fall-off-the-bottom death, on a board whose cast is lifts AND springs AND prizes, so naming
 * it after one of them would narrow it wrongly.
 *
 * LIVE-OUT: memory-only — whatever the dispatched continuation writes. This routine reads the
 * board, MARIO_Y, the level and the frame, and writes nothing of its own.
 */

import { MARIO_Y, LEVEL, FRAME } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";               // reads the mask from a register + BOARD
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";                       // clears MARIO_ACTIVE + the lift flag
import { serviceBoardObjects } from "./serviceBoardObjects.js"; // advance + spawn + publish
import { loc_271e } from "./loc_271e.js";                       // vertical-reposition machine

// Board applicability mask: bit2 selects board 3, so the gate opens only there.
const BOARD_MASK = 0x04;

// At or above this MARIO_Y Mario is at the very BOTTOM of the display — larger Y is LOWER on
// screen, so 240 is the low end of the screen, not the top. The test is on MARIO_Y alone;
// there is no X band, and nothing here says he is on a track or a lift.
const OFF_TRACK_Y = 240;

/**
 * @param {object} m  the machine (uses m.mem; the gate mask is marshalled in a register).
 * @returns {void}
 */
export function service75mBoard(m) {
  const { regs, mem } = m;

  // Board gate: run this service only on the board whose bit is set in the mask.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // gate closed on the other boards -> skip the whole routine

  // Mario at the BOTTOM of the display (larger Y is LOWER on screen) -> kill him. This
  // short-circuits before the level and frame are read.
  if (mem.read8(MARIO_Y) >= OFF_TRACK_Y) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  const level = mem.read8(LEVEL);
  const frame = mem.read8(FRAME);

  if (level !== 1) {
    // Fast cadence (any LEVEL != 1, so level 0 as well as 2+): objects on odd frames,
    // reposition on even frames.
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
  // phases 2 and 3: idle this frame.
}
