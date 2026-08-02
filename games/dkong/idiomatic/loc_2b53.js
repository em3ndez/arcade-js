// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b53 — the non-25m arm of the player-vs-tilemap descent probe.  ROM 0x2B53.
 *
 * Reached from entry_2b29 when the board is NOT 25m ((0x6227) != 1). It probes the
 * tilemap under Mario at up to two offset points and lets the tile classifier
 * (probeTileForLanding) decide, at each point, whether Mario is still clear of the surface,
 * standing over a snap column, or has actually landed:
 *
 *   1. First probe at (X-3, Y+7). If the classifier reports "landed" it has already
 *      snapped Mario and unwound the whole collision walk (its false return); this
 *      routine just propagates that. If it reports the "over a snap column" code (2),
 *      hand off to the horizontal X-snap tail (loc_2b7a). Otherwise (code 0, no
 *      surface here) fall through to the second probe.
 *
 *   2. Second probe at (X+4, Y+7) — the classifier left the first probe's point behind
 *      (its high byte is X-3, its low byte Y+7), and this probe's high byte is that
 *      plus 7. Same three outcomes: landed -> propagate; code 2 -> X-snap tail; code 0
 *      -> nothing under either probe, so return normally and let the caller continue.
 *
 * RETURN CONTRACT (caller-skip): returns true on the normal return (both probes found
 * no surface), and false to signal the two-frame unwind that aborts the collision walk
 * — raised either by the classifier's own landed-unwind or by the X-snap tail. The
 * caller propagates it as `if (loc_2b53(m) === false) return false;`.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callee chain takes honest args): the
 * classifier reads its probe point from the coordinate register pair, so this routine
 * loads exactly what the oracle's `call` sites load — the first probe's (X-3, Y+7) and
 * the second probe's (that-point's-high-byte + 7, that-point's-low-byte) — and reads
 * the classifier's result code back from the accumulator between calls, exactly where
 * the oracle's `cp`/`and a` read it. The object pointer is a live-in passed straight
 * through. loc_2b7a takes no register input (it reads its inputs from memory).
 *
 * Memory-equivalent to the frozen oracle (loc_2b53) — equivalence-2b53.test.js.
 * GATE:     crafted entries on a real attract base that poke the tilemap tile under
 *           each probe point (reject / surface) and the descent inputs, driving all
 *           five terminal paths (first-probe landed, first-probe snap, both-reject
 *           normal return, second-probe landed, second-probe snap); RAM (minus the dead
 *           STACK_SCRATCH the dissolved push/pop churn writes) + pc + SP + result code
 *           identical to the oracle. Teeth: twins that drop the second-probe offset,
 *           drop the first landed-unwind propagation, and invert the snap-code test.
 * LIVE-OUT: memory (MARIO_Y snapped on a landing inside probeTileForLanding; MARIO_X + the sprite
 *           record X committed inside loc_2b7a), the result code, and the caller-skip
 *           boolean (false = the two-frame unwind).
 * NAMES:    probeTileForLanding (ROM 0x2B9B, the tile classifier) and loc_2b7a (ROM 0x2B7A, the
 *           X-snap tail), both direct-called. MARIO_X (0x6203) and MARIO_Y (0x6205) from
 *           ram.js supply the probe point; the tiles are read from tilemap VRAM inside
 *           probeTileForLanding (no ram.js name).
 */

import { u8 } from "../../../core/int.js";
import { probeTileForLanding } from "./probeTileForLanding.js"; // ROM 0x2B9B — tile classifier
import { loc_2b7a } from "./loc_2b7a.js"; // ROM 0x2B7A — horizontal X-snap tail
import { MARIO_X, MARIO_Y } from "./ram.js";

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
