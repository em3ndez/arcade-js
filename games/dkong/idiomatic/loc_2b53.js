// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b53 — the non-25m arm of the player-vs-tilemap descent probe. Probes the tilemap under
 * Mario at (X-3, Y+7) then (X+4, Y+7), letting probeTileForLanding classify each point: "landed"
 * (its false return) propagates the unwind; code 2 (over a snap column) hands off to the X-snap
 * tail arm; code 0 falls through to the next probe, or returns normally after the second.
 *
 * RETURN CONTRACT: `{ skip, verdict }`. `skip` is the caller-skip — true on the normal return (no
 * surface under either probe), false to signal the two-frame unwind that aborts the collision walk.
 * `verdict` is the descent value the airborne handler branches on (formerly left in A): 1 where the
 * probe landed/snapped Mario, 0 otherwise. The register file still carries the same result bytes.
 *
 * LIVE-OUT: memory (Mario's Y snapped on a landing; Mario's X and the sprite-record X on an
 * X-snap), the probe's result code (left on the register file by the probe), and the skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { probeTileForLanding } from "./probeTileForLanding.js";
import { loc_2b7a } from "./loc_2b7a.js";
import { MARIO_X, MARIO_Y } from "./names.js";

export function loc_2b53(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // First probe: high = X-3, low = Y+7.
  const first = (u8(mem8[MARIO_X] - 3) << 8) | u8(mem8[MARIO_Y] + 7);
  const p1 = probeTileForLanding(m, first, ix);
  if (p1.skip === false) return { skip: false, verdict: p1.a };

  if (p1.a === 2) return { skip: loc_2b7a(m), verdict: 1 };

  // Second probe: X+4, Y+7 (a reject left the first point intact, so its low byte == first's).
  const second = (u8(((first >> 8) & 0xff) + 7) << 8) | u8(first & 0xff);
  const p2 = probeTileForLanding(m, second, ix);
  if (p2.skip === false) return { skip: false, verdict: p2.a };

  if (p2.a === 0) return { skip: true, verdict: 0 };
  return { skip: loc_2b7a(m), verdict: 1 };
}
