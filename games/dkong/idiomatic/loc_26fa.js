// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_26fa — per-pass service dispatcher for one board's moving objects.  ROM 0x26FA.
 *
 * Called from the board cascade (ROM 0x197A). A board gate opens the whole routine
 * only when the current board's bit is set in the mask 0x04 (bit2 -> board 3); on
 * every other board the service is skipped entirely.
 *
 * When the gate opens it routes to exactly one of three things by the mover's
 * vertical position and a level-scaled cadence:
 *
 *   - If the tracked Y has run off the top of the track (>= 240) it hands to the
 *     edge reset (loc_277f), which switches the mover off.
 *   - Otherwise it services on a cadence keyed to the frame counter, and the cadence
 *     doubles after the first level:
 *       - Level 1 (the slow cadence): on frame%4 == 0 advance and spawn the board
 *         objects (serviceBoardObjects); on frame%4 == 1 run the vertical-reposition
 *         machine (loc_271e); on the other two frames it idles.
 *       - Later levels (the fast cadence): every odd frame advance/spawn the objects,
 *         every even frame run the reposition machine.
 *   So the objects and the reposition step run twice as often from level 2 on — the
 *   difficulty ramp for this board.
 *
 * The reads happen in order — the position first (its off-track test can short-circuit
 * before the level and frame are ever read), then the level, then the frame.
 *
 * NAME: kept the neutral loc_. The dispatch is exact against the oracle and the
 * mechanism is clear (a board-gated per-frame service router), but which board and
 * which game objects this drives is not confirmed to the routine-name bar — the whole
 * loc_271e / loc_277f / loc_2745 arm family stays loc_ for the same reason. Promote
 * once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-26fa.test.js.
 * GATE:     crafted-entry. 0x26FA rides the gameplay cascade the 25m attract demo
 *           never drives, so the gate-open body arms are unreached in attract; crafted
 *           entries on a real booted base poke the board / position / level / frame
 *           identically on both sides to drive every arm (gate closed, edge reset, both
 *           cadence branches into serviceBoardObjects and loc_271e, and the level-1
 *           idle phases), plus any real gate-closed skips attract does dispatch.
 * LIVE-OUT: memory-only — whatever the dispatched callee writes. This routine reads the
 *           board/position/level/frame and writes nothing of its own; the caller
 *           discards all registers/flags and the terminal return is dead ABI. The
 *           equivalence test still lines pc + SP up to prove the dissolved gate and
 *           tail-call/return brackets match.
 * NAMES:    MARIO_Y (0x6205), LEVEL (0x6229), FRAME (0x601A) from ram.js; boardBitGate
 *           (ROM 0x0030, reads the mask from a register + BOARD), loc_277f (ROM 0x277F),
 *           serviceBoardObjects (ROM 0x2722) and loc_271e (ROM 0x271E) all direct-called.
 */

import { MARIO_Y, LEVEL, FRAME } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js";               // ROM 0x0030 (rst 0x30)
import { loc_277f } from "./loc_277f.js";                       // ROM 0x277F — edge reset
import { serviceBoardObjects } from "./serviceBoardObjects.js"; // ROM 0x2722 — advance + spawn + publish
import { loc_271e } from "./loc_271e.js";                       // ROM 0x271E — vertical-reposition machine

// Board applicability mask: bit2 selects board 3, so the gate opens only there.
const BOARD_MASK = 0x04;

// The tracked Y at or above this value has run off the top of the track.
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

  // The mover ran off the top of its track -> reset it (short-circuits before the
  // level and frame are read).
  if (mem.read8(MARIO_Y) >= OFF_TRACK_Y) {
    loc_277f(m);
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
