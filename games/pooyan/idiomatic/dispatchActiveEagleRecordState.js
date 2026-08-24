// SPDX-License-Identifier: GPL-3.0-only
import { advanceEagleToArrivalAndTallyWave } from "./advanceEagleToArrivalAndTallyWave.js";
import { advanceEagleDiveClimbToRetireAtLimit } from "./advanceEagleDiveClimbToRetireAtLimit.js";
import { despawnEagleAndSeedHoldOnWaveEmpty } from "./despawnEagleAndSeedHoldOnWaveEmpty.js";
/**
 * dispatchActiveEagleRecordState — dispatch an eagle record's per-frame state handler, record based at IX.
 *
 * An inactive record (bit0 of (ix+0)|(ix+1) clear) is skipped; otherwise the record state byte
 * at IX+2 selects one of three handlers (0..2), replacing the frozen layer's inline rst-0x28 word
 * table. Each is a tail hand-off — no continuation is stacked — so the selected handler returns
 * straight to our caller.
 *
 * LIVE-OUT: memory only — the caller's record-scan loop parks its own registers across the call
 * and reads no register or return value back.
 */
const ACTIVE_BIT = 0x01; // (ix+0)|(ix+1) bit0 set == record active
const STATE_OFFSET = 0x02; // record state byte, selects the handler

export function dispatchActiveEagleRecordState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & ACTIVE_BIT) === 0) return; // inactive record

  switch (mem8[rec + STATE_OFFSET]) { // (ix+2) is bounded 0..2 — no other state dispatches
    case 0: return advanceEagleToArrivalAndTallyWave(m, rec);
    case 1: return advanceEagleDiveClimbToRetireAtLimit(m, rec);
    case 2: return despawnEagleAndSeedHoldOnWaveEmpty(m, rec);
  }
}
