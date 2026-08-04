// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a22 — collision check: does Mario overlap any object in the six-record OBJ_ARRAY_66
 * array?
 *
 * A thin parameter-binding wrapper over the generic object-list bounding-box search. It pins
 * that search to OBJ_ARRAY_66 — six records at a 16-byte stride — and delegates. The caller has
 * already staged the reference point and the per-axis tolerances the search reads: Mario's Y,
 * Mario's X via the player record, and a packed pair giving 8 pixels of tolerance on the first
 * axis and 4 on the second. The search outcome — a hit/exhausted flag, plus a
 * count-minus-index residue the caller recovers the matched record from — is this wrapper's
 * whole output; it writes no work RAM.
 *
 * The search can skip a level of return on a hit, but this wrapper's only act after the call is
 * to return, so both the hit and the exhausted path land the caller at the same continuation
 * with the same result. The wrapper therefore neither propagates nor absorbs a skip of its own;
 * it is a plain void routine that discards the search's boolean, because the caller reads the
 * outcome out of the register file, which the search sets on either arm.
 *
 * LIVE-OUT: the search outcome left in the register file — the hit/exhausted flag and the
 * count-minus-matched-index residue. No work RAM is written.
 */

import { findCollidingObject } from "./findCollidingObject.js";
import { OBJ_ARRAY_66 } from "./names.js";

export function loc_2a22(m) {
  const { regs } = m;

  // Bind the generic bounding-box search to the six-record object array and run it.
  regs.b = 0x06; // record / loop count
  regs.de = 0x0010; // record stride
  regs.ix = OBJ_ARRAY_66; // record base
  findCollidingObject(m); // leaves the hit flag and the count − matched index for the caller
}
