// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b53 — the non-25m arm of the player-vs-tilemap descent probe.
 *
 * Reached when the board is NOT 25m. It probes the tilemap under Mario at up to two
 * offset points and lets the tile classifier decide, at each point, whether Mario is
 * still clear of the surface, standing over a snap column, or has actually landed:
 *
 *   1. First probe at (X-3, Y+7). If the classifier reports "landed" it has already
 *      snapped Mario and unwound the whole collision walk (its false return); this
 *      routine just propagates that. If it reports the "over a snap column" code (2),
 *      hand off to the horizontal X-snap tail. Otherwise (code 0, no surface here)
 *      fall through to the second probe.
 *
 *   2. Second probe at (X+4, Y+7) — the classifier leaves the first probe's point
 *      behind in the coordinate register pair (high byte X-3, low byte Y+7), and this
 *      probe's high byte is that one plus 7. Same three outcomes: landed -> propagate;
 *      code 2 -> X-snap tail; code 0 -> nothing under either probe, so return normally
 *      and let the caller continue.
 *
 * RETURN CONTRACT (caller-skip): returns true on the normal return (both probes found
 * no surface), and false to signal the two-frame unwind that aborts the collision walk
 * — raised either by the classifier's own landed-unwind or by the X-snap tail. The
 * caller propagates the false straight up.
 *
 * REGISTER-ABI MARSHALLING: the classifier reads its probe point out of the coordinate
 * register pair, so this routine loads each probe point there and reads the
 * classifier's result code back from the accumulator between calls. The object pointer
 * is a live-in passed straight through. The X-snap tail takes no register input — it
 * reads its inputs from memory.
 *
 * LIVE-OUT: memory (Mario's Y snapped on a landing inside the classifier; Mario's X
 * and the sprite record's X committed inside the X-snap tail), the result code, and
 * the caller-skip boolean (false = the two-frame unwind).
 */

import { u8 } from "../../../core/int.js";
import { probeTileForLanding } from "./probeTileForLanding.js"; // the tile classifier
import { loc_2b7a } from "./loc_2b7a.js"; // horizontal X-snap tail
import { MARIO_X, MARIO_Y } from "./names.js";

/**
 * @param {object} m  the machine. Live-in: the object pointer (passed through to the
 *   classifier). Live-out: memory (see header), the result code, and the boolean.
 * @returns {boolean} true = normal return; false = the two-frame collision-walk unwind.
 */
export function loc_2b53(m) {
  const { regs } = m;

  // First probe point: high byte = Mario's X minus 3, low byte = Mario's Y plus 7.
  regs.hl = (u8(m.mem.read8(MARIO_X) - 3) << 8) | u8(m.mem.read8(MARIO_Y) + 7);
  if (probeTileForLanding(m) === false) return false; // classifier landed Mario -> propagate the unwind

  // Result code 2 -> Mario is over a snap column: hand off to the X-snap tail.
  if (regs.a === 2) return loc_2b7a(m);

  // Otherwise (code 0, no surface at the first point) probe again. The classifier left
  // the first point in the coordinate pair (high = X-3, low = Y+7); the second point's
  // high byte is that high byte plus 7, its low byte unchanged.
  regs.hl = (u8(regs.d + 7) << 8) | u8(regs.e);
  if (probeTileForLanding(m) === false) return false; // landed on the second probe -> propagate

  // Code 0 at both points: nothing underfoot, normal return. Code 2 -> the X-snap tail.
  if (regs.a === 0) return true;
  return loc_2b7a(m);
}
