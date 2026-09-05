// SPDX-License-Identifier: GPL-3.0-only
// Sets a 0/1 movement-direction flag from the formation anchor's position relative to the current X
// sweep bounds: when the anchor sits within a small margin of a bound the flag is forced away from that
// edge, otherwise a fresh random draw picks it.
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import { loc_420e as FORMATION_ANCHOR, FORMATION_X_BOUNDS, loc_4215 } from "./names.js";

const EDGE_MARGIN = 28; // within this of a bound, force the direction instead of randomizing

export function loc_13e1(m) {
  const { mem8 } = m;

  const anchorLow = mem8[FORMATION_ANCHOR];
  const anchorHigh = mem8[FORMATION_ANCHOR + 1];
  const lowBound = mem8[FORMATION_X_BOUNDS];
  const highBound = mem8[FORMATION_X_BOUNDS + 1];

  // The 16-bit anchor's sign picks which bound to measure the gap against (an unsigned 8-bit difference).
  const negative = (anchorHigh & 0x80) !== 0;
  const gap = negative ? (anchorLow - highBound) & 0xff : (lowBound - anchorLow) & 0xff;

  if (gap >= EDGE_MARGIN) {
    mem8[loc_4215] = advanceRandomSeed(m) & 0x01;
    return;
  }
  mem8[loc_4215] = negative ? 0 : 1;
}
