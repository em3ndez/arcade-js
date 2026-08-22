// SPDX-License-Identifier: GPL-3.0-only
import { loc_0fc3 } from "./loc_0fc3.js";
/**
 * loc_0fad — queue the four-tile run that opens with tile code 0x26.
 *
 * Loads the leading tile code and tail-calls the four-tile run emitter, which appends that
 * byte and the three fixed run tiles into the command ring.
 * LIVE-OUT: A = the advanced ring cursor the emitter leaves (0 when the append gates are
 * closed); the flag/accumulator pair is not restored across the tail, so the caller reads it.
 */

const LEAD_TILE = 0x26; // the run's leading tile code

export function loc_0fad(m) {
  return loc_0fc3(m, LEAD_TILE);
}
