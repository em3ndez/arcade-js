// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a22 — collision check: does Mario overlap any object in the six-record OBJ_ARRAY_66 array?
 * A thin parameter-binding wrapper over the generic object-list bounding-box search, pinning it to
 * OBJ_ARRAY_66 (six records, 16-byte stride) and delegating. The caller has already staged the
 * reference point and per-axis tolerances; the search leaves a hit/exhausted flag plus a
 * count-minus-index residue in the register file, which the caller reads out. This wrapper's only
 * act after the call is to return, so it neither propagates nor absorbs a skip and writes no RAM.
 */

import { findCollidingObject } from "./findCollidingObject.js";
import { OBJ_ARRAY_66 } from "./names.js";

export function loc_2a22(m) {
  const { regs } = m;

  regs.b = 0x06; // record / loop count
  regs.de = 16; // record stride
  regs.ix = OBJ_ARRAY_66; // record base
  findCollidingObject(m);
}
