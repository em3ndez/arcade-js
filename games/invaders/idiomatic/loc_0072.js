// SPDX-License-Identifier: GPL-3.0-only
import { drawPendingAlien } from "./drawPendingAlien.js";
import { loc_0248 } from "./loc_0248.js";
import { tickSaucerSpawnTimer } from "./tickSaucerSpawnTimer.js";
import { loc_2080, loc_2032 } from "./names.js";

// The vblank in-game record tail: copy the per-frame latch cell forward, redraw the pending marching
// alien, walk the vblank object-record table, then step the saucer timer. A record handler may arm a
// warm restart during the walk, in which case skip the saucer step so the interrupt returns promptly.
export function loc_0072(m) {
  m.mem8[loc_2080] = m.mem8[loc_2032];
  drawPendingAlien(m);
  loc_0248(m);
  if (m.nextMain) return;
  tickSaucerSpawnTimer(m);
}
