// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3945 — cadence front end for the actor phase body: count the period-8 timer
 * down one tick, reload it to 8 on the tick it runs out, then run the phase body.
 * ROM 0x3945.
 *
 * Reached each frame on the actor's move path (handed here by loc_38c8 when the
 * actor's X sits in the high half of the field). What it does:
 *   - It advances the shared cadence timer down by one on every entry.
 *   - On the single tick where the count runs out (a decrement of 1 down to 0) it
 *     reloads the timer to the full period of 8 before continuing; on every other
 *     tick it keeps the new count.
 *   - It then runs the phase body (loc_3968) on the freshly-updated timer. The body
 *     reads the very byte written here to decide whether this is one of its active
 *     ticks, and its return carries through to this routine's own caller.
 *
 * The 19-byte span the reload path steps over is unreached dead code, so it has no
 * behaviour to reproduce here.
 *
 * The name stays neutral to match the phase body it feeds: which actor the cadence
 * paces is not pinned in the mechanism map, and the timer byte carries only a
 * fair-confidence name — not enough evidence to earn an English name for the front
 * end when its own body deliberately stayed neutral for the same reason.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3945.test.js.
 * GATE:     captured dispatches + exhaustive over the timer byte. Reached naturally
 *           in attract (the move-path front end feeding loc_3968); swept over all 256
 *           timer values so the run-out reload tick, the 8-bit wrap edge, and the
 *           ordinary count-down ticks are all covered; plus teeth.
 * LIVE-OUT: memory-only — the cadence timer (0x8112) it writes, which the phase body
 *           reads immediately. Every working register is overwritten downstream
 *           before it is read, so the registers this routine leaves are dead; the
 *           whole-machine gate backstops that.
 * NAMES:    ACTOR_TIMER (0x8112, the period-8 cadence timer) — fair-confidence.
 */

import { ACTOR_TIMER } from "./ram.js";
import { loc_3968 } from "./loc_3968.js";

export function loc_3945(m) {
  const { mem } = m;

  // Count the period-8 cadence timer down one tick, wrapping as the 8-bit counter
  // does, then reload it to a full period of 8 on the single tick it runs out.
  const counter = mem.read8(ACTOR_TIMER);
  const ticked = counter === 0 ? 255 : counter - 1;
  mem.write8(ACTOR_TIMER, ticked === 0 ? 8 : ticked);

  // Run the phase body on the freshly-updated timer; its return is ours.
  return loc_3968(m);
}
