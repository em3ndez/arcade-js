// SPDX-License-Identifier: GPL-3.0-only
import { FORMATION_TABLE } from "./names.js";

const RECORD_STRIDE = 0x18; // bytes between consecutive formation records
const RECORD_COUNT = 4;

/**
 * dispatchFormationObjectStates — run the object-state dispatcher over the four formation records.
 *
 * Walk the four fixed-stride records and hand each one to the shared per-object state
 * dispatcher (kept marshalled: the dispatcher is not lifted this batch). The loop counter
 * and stride are local, so no register needs parking across the call.
 *
 * LIVE-OUT: memory only (the sole callers are straight-line sequencers that read no register
 * back).
 */
export function dispatchFormationObjectStates(m) {
  let record = FORMATION_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    m.regs.ix = record; // the dispatcher reads the record pointer from IX
    m.push16(0x40ca); // return slot the dispatcher's ret consumes
    m.call(0x40d0);
    record += RECORD_STRIDE;
  }
}
