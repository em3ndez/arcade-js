// SPDX-License-Identifier: GPL-3.0-only
import { FORMATION_TABLE } from "./names.js";
import { loc_40d0 } from "./loc_40d0.js";

const RECORD_STRIDE = 0x18; // bytes between consecutive formation records
const RECORD_COUNT = 4;

/**
 * dispatchFormationObjectStates — run the object-state dispatcher over the four formation records.
 *
 * Walk the four fixed-stride records and hand each record pointer to the shared per-object state
 * dispatcher as an argument.
 *
 * LIVE-OUT: memory only (the sole callers are straight-line sequencers that read no register
 * back).
 */
export function dispatchFormationObjectStates(m) {
  let record = FORMATION_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    loc_40d0(m, record);
    record += RECORD_STRIDE;
  }
}
