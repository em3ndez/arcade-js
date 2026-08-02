// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_26fa — per-pass service dispatcher for one board's moving objects.  ROM 0x26FA.
 *
 * Called from the board cascade (ROM 0x197A). A board gate opens the whole routine
 * only when the current board's bit is set in the mask 0x04 (bit2 -> board 3); on
 * every other board the service is skipped entirely.
 *
 * When the gate opens it routes on MARIO_Y (0x6205) and a level-scaled cadence. There are
 * FOUR outcomes, not three — the fourth is doing nothing:
 *
 *   - If MARIO_Y is at or above 240 — larger Y is LOWER on screen, so this is Mario at the
 *     very bottom of the display — it hands to killMarioAtEndOfLiftTravel, which kills him
 *     (ROM 0x2702 `jp nc,0x277F` on MARIO_Y >= 0xF0, with NO X-band test, so he need not be
 *     on a lift at all).
 *   - Otherwise it services on a cadence keyed to the frame counter, and the cadence
 *     doubles after the first level:
 *       - Level 1 (the slow cadence): on frame%4 == 0 advance and spawn the board
 *         objects (serviceBoardObjects); on frame%4 == 1 run the vertical-reposition
 *         machine (loc_271e); on the other two frames it idles — that idle is a bare
 *         `ret` at ROM 0x2719, the fourth outcome.
 *       - Later levels (the fast cadence): every odd frame advance/spawn the objects,
 *         every even frame run the reposition machine, so there is no idle phase.
 *   So the objects and the reposition step run twice as often from level 2 on — the
 *   difficulty ramp for this board.
 *
 * The reads happen in order — MARIO_Y first (its bottom-of-screen test can short-circuit
 * before the level and frame are ever read), then the level, then the frame.
 *
 * NAME: kept the neutral loc_. The dispatch is exact against the oracle and the
 * mechanism is clear (a board-gated per-frame service router), but which game objects
 * this drives is not confirmed to the routine-name bar — its
 * delegate loc_271e stays loc_ for the same reason. Two of the arms below it WERE
 * promoted in this pass — dispatchElevatorRideByColumn (ROM 0x2745) and
 * killMarioAtEndOfLiftTravel (ROM 0x277F) — on evidence about the movers they drive. What
 * remains unnamed here is the service this gate drives, NOT the board: 0x2745 is
 * reachable only through this router (its single referent is the `call` at 0x271E, itself
 * reached only from 0x2713/0x271B), so that routine's board=3 corroboration is evidence about
 * this gate too. Promote once that service is corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-26fa.test.js.
 * GATE:     crafted-entry. 0x26FA rides the gameplay cascade the 25m attract demo
 *           never drives, so the gate-open body arms are unreached in attract; crafted
 *           entries on a real booted base poke the board / MARIO_Y / level / frame
 *           identically on both sides to drive every arm (gate closed, the kill arm, both
 *           cadence branches into serviceBoardObjects and loc_271e, and the level-1
 *           idle phases), plus any real gate-closed skips attract does dispatch.
 * LIVE-OUT: memory-only — whatever the dispatched callee writes. This routine reads the
 *           board/MARIO_Y/level/frame and writes nothing of its own; the caller
 *           discards all registers/flags and the terminal return is dead ABI. The
 *           equivalence test still lines pc + SP up to prove the dissolved gate and
 *           tail-call/return brackets match.
 * NAMES:    MARIO_Y (0x6205), LEVEL (0x6229), FRAME (0x601A) from ram.js; boardBitGate
 *           (ROM 0x0030, reads the mask from a register + BOARD), killMarioAtEndOfLiftTravel (ROM 0x277F),
 *           serviceBoardObjects (ROM 0x2722) and loc_271e (ROM 0x271E) all direct-called.
 */

import { MARIO_Y, LEVEL, FRAME } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js";               // ROM 0x0030 (rst 0x30)
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";                       // ROM 0x277F — kill Mario (clears MARIO_ACTIVE + EDGE_REPOSITION_FLAG)
import { serviceBoardObjects } from "./serviceBoardObjects.js"; // ROM 0x2722 — advance + spawn + publish
import { loc_271e } from "./loc_271e.js";                       // ROM 0x271E — vertical-reposition machine

// Board applicability mask: bit2 selects board 3, so the gate opens only there.
const BOARD_MASK = 0x04;

// At or above this MARIO_Y Mario is at the very BOTTOM of the display — larger Y is LOWER on
// screen, so 240 is the low end of the screen, not the top. The test is on MARIO_Y alone; there
// is no X band and nothing here says he is on a track or a lift. (The const's "OFF_TRACK" name
// predates that finding and is a code change, so it stands for now.)
const OFF_TRACK_Y = 240;

/**
 * @param {object} m  the machine (uses m.mem; the gate mask is marshalled in a register).
 * @returns {void}
 */
export function loc_26fa(m) {
  const { regs, mem } = m;

  // Board gate: run this service only on the board whose bit is set in the mask.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // gate closed on the other boards -> skip the whole routine

  // Mario at the BOTTOM of the display (larger Y is LOWER on screen) -> kill him: 0x277F
  // clears MARIO_ACTIVE and EDGE_REPOSITION_FLAG. Short-circuits before the level and frame
  // are read.
  if (mem.read8(MARIO_Y) >= OFF_TRACK_Y) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  const level = mem.read8(LEVEL);
  const frame = mem.read8(FRAME);

  if (level !== 1) {
    // Fast cadence (level 2 on): objects on odd frames, reposition on even frames.
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
