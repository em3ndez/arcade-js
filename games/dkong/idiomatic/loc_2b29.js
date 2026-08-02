// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b29 — the board split at the head of the player-vs-tilemap descent probe: off 25m hand
 * the whole probe to loc_2b53, on 25m run the single-point probe and, when Mario is within
 * three pixels of the tile surface under him, snap him onto it.  ROM 0x2B29.
 *
 * Reached from the still-translated entry_2b1c (which supplies the object pointer). On any board
 * but 25m (BOARD != 1) it does nothing itself — the whole descent probe is loc_2b53's two-point
 * form, and this routine's result is loc_2b53's. On 25m it probes a single point:
 *
 *   1. Probe point = (MARIO_X, MARIO_Y + 7). The tile classifier probeTileForLanding takes the
 *      pair with MARIO_X in the high byte and MARIO_Y + 7 in the low byte — the tilemap address
 *      arithmetic uses the high byte as its row term and the low byte as its column term, so the
 *      column boundary the classifier hands back is in the same units as MARIO_Y, which is why
 *      the snap below writes it straight into MARIO_Y. loc_2b53 builds its probe points the same
 *      way.
 *
 *   2. LANDED — the classifier found Mario at or past the tile surface. It has already snapped
 *      MARIO_Y and unwound the whole collision walk (its false return); this routine just
 *      propagates that.
 *
 *   3. NO SURFACE (classifier code 0) — nothing landable under the probe point, so abort the walk
 *      through loc_2b51, carrying the classifier's zeroed result.
 *
 *   4. SURFACE, STILL CLEAR OF IT (classifier code 2) — measure how far the probe point sits past
 *      the surface boundary the classifier computed. Four or more pixels is still too far to land:
 *      abort through loc_2b74, which reports the zeroed result. Under four pixels Mario is close
 *      enough: snap MARIO_Y to seven above the boundary, report the landed result (1, 1), and take
 *      the same abort exit through loc_2b51.
 *
 * So the 25m arm lands Mario one probe early — the classifier itself only lands him once he is at
 * or past the boundary, and this arm additionally lands him from up to three pixels short of it.
 *
 * RETURN CONTRACT (caller-skip): true = the normal return, so entry_2b1c goes on to its follow-up;
 * false = the two-frame unwind that abandons the probe and returns past entry_2b1c to its own
 * caller. Only the off-25m arm can return true (loc_2b53's both-probes-clear path); every 25m
 * outcome unwinds. entry_2b1c consumes it as `if (!loc_2b29(m)) return;`.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the caller chain is decompiled): the callee chain still
 * passes coordinates and results in registers, so this routine loads the probe point into the
 * coordinate pair, reads the classifier's result code, surface boundary and probe coordinate back
 * out, and — on the snap arm — leaves the (1, 1) result where the still-translated consumer past
 * entry_2b1c reads it (it decrements the first result byte, then the second). The object pointer is
 * a live-in passed straight through to the classifier.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b29.test.js.
 * GATE:     captured + crafted. 0x2B29 is NATURALLY REACHED — 443 real dispatches in an 8000-frame
 *           attract run (entry_1c05 -> entry_2b1c -> here), covering three of the five terminal
 *           paths: the no-surface abort (400x), the too-far abort (32x) and the classifier's
 *           landed-unwind (11x). Attract plays 25m only and never gets within three pixels of a
 *           boundary, so the off-25m arm and the snap arm are crafted on a real attract base — the
 *           board poked to 2, or the probe tile and the descent inputs poked to put the probe point
 *           3 (snap) and 4 (too far) past the boundary, which also pins the threshold itself.
 *           Every case compares RAM (minus the dead STACK_SCRATCH the oracle's dissolved
 *           push/pop/return churn writes) + pc + SP + both live result bytes.
 * LIVE-OUT: MARIO_Y on the snap arm (and inside the classifier on its own landed arm); the two
 *           result bytes the consumer past entry_2b1c reads back; and the caller-skip boolean
 *           (false = the two-frame unwind). The residual coordinate/flag state is dead ABI.
 * NAMES:    BOARD (0x6227), MARIO_X (0x6203), MARIO_Y (0x6205) from ram.js. The probed tile lives
 *           in the hardware tilemap VRAM the classifier addresses, which has no ram.js name.
 *           Direct-called: loc_2b53 (ROM 0x2B53), probeTileForLanding (ROM 0x2B9B), loc_2b51
 *           (ROM 0x2B51), loc_2b74 (ROM 0x2B74).
 */

import { u8 } from "../../../core/int.js";
import { loc_2b53 } from "./loc_2b53.js"; // ROM 0x2B53 — the off-25m two-point probe
import { probeTileForLanding } from "./probeTileForLanding.js"; // ROM 0x2B9B — the tile classifier
import { loc_2b51 } from "./loc_2b51.js"; // ROM 0x2B51 — the plain abort exit
import { loc_2b74 } from "./loc_2b74.js"; // ROM 0x2B74 — the abort exit that zeroes the result
import { BOARD, MARIO_X, MARIO_Y } from "./ram.js";

const BOARD_25M = 1;
const PROBE_OFFSET = 7; // pixels below Mario the probe point sits, and the snap's clearance
const SNAP_REACH = 4;   // land only while the probe point is under this far past the boundary

/**
 * @param {object} m  the machine. Live-in: the object pointer (passed through to the classifier).
 *   Live-out: MARIO_Y on the snap arm, the two result bytes, and the boolean.
 * @returns {boolean} true = normal return; false = the two-frame collision-walk unwind.
 */
export function loc_2b29(m) {
  const { regs, mem } = m;

  // Off 25m the descent probe is loc_2b53's two-point form; its result is ours.
  if (mem.read8(BOARD) !== BOARD_25M) return loc_2b53(m);

  // 25m: one probe point, seven pixels below Mario.
  regs.hl = (mem.read8(MARIO_X) << 8) | u8(mem.read8(MARIO_Y) + PROBE_OFFSET);
  if (probeTileForLanding(m) === false) return false; // classifier landed Mario -> propagate the unwind

  // Result code 0: nothing landable under the probe point — abort, carrying the zeroed result.
  if (regs.a === 0) return loc_2b51(m);

  // Result code 2: there IS a surface here and Mario is still clear of it. The classifier left the
  // surface boundary and the probe point's coordinate behind; both are byte-wide, so the gap
  // between them is measured at that width.
  const probeCoord = regs.e;
  const surfaceBoundary = regs.c;
  if (u8(probeCoord - surfaceBoundary) >= SNAP_REACH) return loc_2b74(m); // too far to land

  // Within reach: snap Mario onto the surface and report the landed result to the consumer past
  // entry_2b1c, then abort the rest of the walk.
  mem.write8(MARIO_Y, surfaceBoundary - PROBE_OFFSET);
  regs.a = 1;
  regs.b = 1;
  return loc_2b51(m);
}
