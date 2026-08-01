// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2745 — the vertical-reposition machine: gate on the reposition flag, then
 * dispatch by Mario's X into the mover arms or the edge reset.  ROM 0x2745.
 *
 * Runs only when a reposition has just been flagged and Mario is grounded; two
 * guards drop the whole routine otherwise:
 *   - EDGE_REPOSITION_FLAG clear — nothing to reposition this frame, so it returns.
 *   - MARIO_AIRBORNE set — busy in the air, so it leaves the reposition for a
 *     grounded frame and returns.
 *
 * With both guards open it reads MARIO_X and routes by X band. Two disjoint bands
 * run a vertical mover arm (loc_276f and loc_2787, which step Mario's Y and mirror
 * it to the sprite record, handing off to the edge reset at the end of their
 * travel); every X outside those two bands runs the plain edge reset loc_2766,
 * which starts Mario falling and clears the reposition flag. Nothing is written
 * here directly — every effect is the dispatched arm's.
 *
 * NAME: kept the neutral loc_. The dispatch and guards are exact against the
 * oracle, but which game event drives this reposition is not confirmed to the
 * routine-name bar — the whole arm family (loc_276f/loc_2787/loc_277f/loc_2766)
 * stays loc_ for the same reason. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2745.test.js.
 * GATE:     crafted-entry. 0x2745 is NEVER dispatched in attract (0 over 6000
 *           frames — the reposition flag it gates on is only raised by a gameplay
 *           mover attract's 25m demo never drives), so crafted entries on a real
 *           booted attract base carry the gate: an EXHAUSTIVE MARIO_X sweep (all
 *           256, so every band boundary) crossed with a MARIO_Y set that drives
 *           both sub-arms of each mover, plus the two guard early-outs. Teeth: a
 *           wrong band boundary, an inverted reposition-flag guard, and an
 *           inverted airborne guard.
 * LIVE-OUT: memory-only — whatever the dispatched arm writes. This routine reads
 *           three cells and writes none of its own; the caller (the sub_271e
 *           wrapper, itself a discarded per-frame tail) consumes no register/flag,
 *           and the terminal return is dead ABI. The equivalence test still lines
 *           pc + SP up to prove the dissolved tail-jump/return bracket matches.
 * NAMES:    EDGE_REPOSITION_FLAG (0x6398), MARIO_AIRBORNE (0x6216), MARIO_X
 *           (0x6203) from ram.js; loc_2766 (ROM 0x2766), loc_276f (ROM 0x276F),
 *           loc_2787 (ROM 0x2787) direct-called with no register inputs.
 */

import { EDGE_REPOSITION_FLAG, MARIO_AIRBORNE, MARIO_X } from "./ram.js";
import { loc_2766 } from "./loc_2766.js"; // ROM 0x2766 — start Mario falling, clear the flag
import { loc_276f } from "./loc_276f.js"; // ROM 0x276F — vertical mover arm
import { loc_2787 } from "./loc_2787.js"; // ROM 0x2787 — vertical mover arm

// Mario's X selects the reposition action. Two disjoint X bands run a vertical
// mover arm; every X outside them runs the plain edge reset loc_2766.
const MOVER_276F_BAND_LO = 44;   // [44, 67)   -> loc_276f
const MOVER_276F_BAND_HI = 67;
const MOVER_2787_BAND_LO = 108;  // [108, 131) -> loc_2787
const MOVER_2787_BAND_HI = 131;

/**
 * @param {object} m  the machine (uses m.mem; dispatches into loc_2766/276f/2787).
 * @returns {void}
 */
export function loc_2745(m) {
  const { mem } = m;

  // Inactive unless a reposition was just flagged.
  if (mem.read8(EDGE_REPOSITION_FLAG) === 0) return;

  // Busy while airborne — leave the reposition for a grounded frame.
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;

  // Dispatch by X band (ascending thresholds, mirroring the oracle's cascade).
  const x = mem.read8(MARIO_X);
  if (x < MOVER_276F_BAND_LO) { loc_2766(m); return; } // below the first mover band
  if (x < MOVER_276F_BAND_HI) { loc_276f(m); return; } // [44, 67)
  if (x < MOVER_2787_BAND_LO) { loc_2766(m); return; } // gap band between the movers
  if (x < MOVER_2787_BAND_HI) { loc_2787(m); return; } // [108, 131)
  loc_2766(m);                                          // [131, 255]
}
