// SPDX-License-Identifier: GPL-3.0-only
import { loc_0fc3 } from "./loc_0fc3.js";
/**
 * loc_0f92 — queue the phase-exhausted tile run.
 *
 * Supplies the fixed lead tile code and tail-calls the four-tile run appender, whose command
 * ring writes (and result) become this routine's.
 *
 * LIVE-OUT: A = the advanced ring cursor left by the tail-call (zero when the append gates are
 * closed); the immediate caller reloads A before reading it, so it is set but not consumed.
 */

const LEAD_TILE = 0x1d; // the run's caller-supplied lead tile

export function loc_0f92(m) {
  return loc_0fc3(m, LEAD_TILE);
}
