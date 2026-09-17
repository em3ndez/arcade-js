// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b53 — the non-25m arm of the player-vs-tilemap descent probe. Probes the tilemap under
 * Mario at (X-3, Y+7) then (X+4, Y+7), letting probeTileForLanding classify each point: "landed"
 * (its false return) propagates the unwind; code 2 (over a snap column) hands off to the X-snap
 * tail arm; code 0 falls through to the next probe, or returns normally after the second.
 *
 * RETURN CONTRACT (caller-skip): true on the normal return (no surface under either probe), false
 * to signal the two-frame unwind that aborts the collision walk.
 *
 * LIVE-OUT: memory (Mario's Y snapped on a landing; Mario's X and the sprite-record X on an
 * X-snap), the result code, and the caller-skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { probeTileForLanding } from "./probeTileForLanding.js";
import { loc_2b7a } from "./loc_2b7a.js";
import { MARIO_X, MARIO_Y } from "./names.js";

export function loc_2b53(m) {
  const { regs, mem8 } = m;

  // First probe: high = X-3, low = Y+7.
  regs.hl = (u8(mem8[MARIO_X] - 3) << 8) | u8(mem8[MARIO_Y] + 7);
  if (probeTileForLanding(m) === false) return false;

  if (regs.a === 2) return loc_2b7a(m);

  // Second probe: the classifier left the first point in DE (high X-3, low Y+7); this high byte is +7.
  regs.hl = (u8(regs.d + 7) << 8) | u8(regs.e);
  if (probeTileForLanding(m) === false) return false;

  if (regs.a === 0) return true;
  return loc_2b7a(m);
}
