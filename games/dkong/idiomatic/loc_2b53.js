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
 * X-snap), the probe's result code (left on the register file by the probe), and the skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { probeTileForLanding } from "./probeTileForLanding.js";
import { loc_2b7a } from "./loc_2b7a.js";
import { MARIO_X, MARIO_Y } from "./names.js";

export function loc_2b53(m) {
  const { mem8 } = m;

  // First probe: high = X-3, low = Y+7.
  const first = (u8(mem8[MARIO_X] - 3) << 8) | u8(mem8[MARIO_Y] + 7);
  if (probeTileForLanding(m, first) === false) return false;

  if (m.regs.a === 2) return loc_2b7a(m);

  // Second probe: a reject leaves the first point intact — high X-3, low Y+7 — so its bytes are
  // exactly `first`'s; the new high byte is +7 (X+4).
  const second = (u8(((first >> 8) & 0xff) + 7) << 8) | u8(first & 0xff);
  if (probeTileForLanding(m, second) === false) return false;

  if (m.regs.a === 0) return true;
  return loc_2b7a(m);
}
