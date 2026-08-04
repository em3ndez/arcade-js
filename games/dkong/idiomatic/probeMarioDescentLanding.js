// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeMarioDescentLanding — the board split at the head of the player-vs-tilemap descent
 * probe: off 25m hand the whole probe to the two-point form, and on 25m run a single-point
 * probe that snaps Mario onto the tile surface under him when he is within three pixels of it.
 *
 * The object pointer arrives from the caller. On any board but 25m (BOARD != 1) this routine
 * does nothing itself — the whole descent probe is the two-point form's, and this routine's
 * result is that form's result. On 25m it probes a single point:
 *
 *   1. Probe point = (MARIO_X, MARIO_Y + 7). The tile classifier takes the pair with MARIO_X
 *      in the high byte and MARIO_Y + 7 in the low byte: the tilemap address arithmetic uses
 *      the high byte as its row term and the low byte as its column term, so the column
 *      boundary the classifier hands back is in the same units as MARIO_Y — which is why the
 *      snap below writes it straight into MARIO_Y. The two-point form builds its probe points
 *      the same way.
 *
 *   2. LANDED — the classifier found Mario at or past the tile surface. It has already
 *      snapped MARIO_Y and unwound the whole collision walk, and this routine just
 *      propagates that.
 *
 *   3. NO SURFACE (classifier code 0) — nothing landable under the probe point, so abort the
 *      walk through the plain exit, carrying the classifier's zeroed result.
 *
 *   4. SURFACE, STILL CLEAR OF IT (classifier code 2) — measure how far the probe point sits
 *      past the surface boundary the classifier computed. Four or more pixels is still too
 *      far to land: abort through the exit that reports a zeroed result. Under four pixels
 *      Mario is close enough: snap MARIO_Y to seven above the boundary, report the landed
 *      result (1, 1), and take the plain abort exit.
 *
 * So the 25m arm lands Mario one probe early — the classifier itself only lands him once he
 * is at or past the boundary, and this arm additionally lands him from up to three pixels
 * short of it.
 *
 * RETURN CONTRACT (caller-skip): true = the normal return, so the caller goes on to its
 * follow-up; false = the two-frame unwind that abandons the probe and returns past the caller
 * to its own caller. Only the off-25m arm can return true, on the both-probes-clear path;
 * every 25m outcome unwinds.
 *
 * WHAT THE NAME DOES NOT CLAIM: "probe" rather than "land" is deliberate — off 25m this
 * routine only DELEGATES, and the landing there belongs to the two-point form, so the name
 * must not assert that this routine lands Mario in general. It also does not claim the 25m
 * snap is a player-visible behaviour: the three-pixel reach is read off the code, not observed
 * on a playfield. Confidence in the name is MEDIUM, because the corroboration for it comes
 * from the cells it touches and from its callees rather than from the caller chain.
 *
 * The callee chain passes coordinates and results in registers, so this routine loads the
 * probe point into the coordinate pair, reads the classifier's result code, surface boundary
 * and probe coordinate back out, and — on the snap arm — leaves the (1, 1) result where the
 * consumer past the caller reads it back, decrementing the first byte and then the second.
 * The object pointer is a live-in passed straight through to the classifier. The probed tile
 * itself lives in tilemap video memory rather than in a named cell.
 *
 * LIVE-OUT: MARIO_Y on the snap arm (and inside the classifier on its own landed arm); the two
 * result bytes the consumer reads back; and the caller-skip boolean, where false is the
 * two-frame unwind.
 */

import { u8 } from "../../../core/int.js";
import { loc_2b53 } from "./loc_2b53.js"; // the off-25m two-point probe
import { probeTileForLanding } from "./probeTileForLanding.js"; // the tile classifier
import { loc_2b51 } from "./loc_2b51.js"; // the plain abort exit
import { loc_2b74 } from "./loc_2b74.js"; // the abort exit that zeroes the result
import { BOARD, MARIO_X, MARIO_Y } from "./names.js";

const BOARD_25M = 1;
const PROBE_OFFSET = 7; // pixels below Mario the probe point sits, and the snap's clearance
const SNAP_REACH = 4;   // land only while the probe point is under this far past the boundary

/**
 * @param {object} m  the machine. Live-in: the object pointer (passed through to the classifier).
 *   Live-out: MARIO_Y on the snap arm, the two result bytes, and the boolean.
 * @returns {boolean} true = normal return; false = the two-frame collision-walk unwind.
 */
export function probeMarioDescentLanding(m) {
  const { regs, mem } = m;

  // Off 25m the descent probe is the two-point form; its result is ours.
  if (mem.read8(BOARD) !== BOARD_25M) return loc_2b53(m);

  // 25m: one probe point, seven pixels below Mario.
  regs.hl = (mem.read8(MARIO_X) << 8) | u8(mem.read8(MARIO_Y) + PROBE_OFFSET);
  if (probeTileForLanding(m) === false) return false; // the classifier landed him — propagate the unwind

  // Result code 0: nothing landable under the probe point — abort, carrying the zeroed result.
  if (regs.a === 0) return loc_2b51(m);

  // Result code 2: there IS a surface here and Mario is still clear of it. The classifier left the
  // surface boundary and the probe point's coordinate behind; both are byte-wide, so the gap
  // between them is measured at that width.
  const probeCoord = regs.e;
  const surfaceBoundary = regs.c;
  if (u8(probeCoord - surfaceBoundary) >= SNAP_REACH) return loc_2b74(m); // too far to land

  // Within reach: snap Mario onto the surface and report the landed result to the consumer
  // past the caller, then abort the rest of the walk.
  mem.write8(MARIO_Y, surfaceBoundary - PROBE_OFFSET);
  regs.a = 1;
  regs.b = 1;
  return loc_2b51(m);
}
