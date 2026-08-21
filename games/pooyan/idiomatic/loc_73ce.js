// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { WAVE_RECORD_COUNT, WAVE_HOLD_TIMER } from "./names.js";
/**
 * loc_73ce — eagle-record state 2 (retire): clear the record, then maybe seed the inter-wave hold.
 *
 * Zero-fills the whole 0x18-byte record based at IX, then decrements the live-record count. When
 * that count reaches zero — the last record of the wave has retired — it seeds the inter-wave
 * hold countdown to 0x30.
 *
 * LIVE-OUT: none — a dispatch target; its exit registers are not consumed by the caller.
 */

const RECORD_LEN = 0x18; //     the eagle record is 0x18 bytes
const RECORD_FILL = 0x00; //    cleared to zero
const INTER_WAVE_HOLD = 0x30; // reseed value for the hold countdown

export function loc_73ce(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_0010(m, rec, RECORD_FILL, RECORD_LEN);

  mem8[WAVE_RECORD_COUNT] = mem8[WAVE_RECORD_COUNT] - 1;
  if (mem8[WAVE_RECORD_COUNT] !== 0) return;

  mem8[WAVE_HOLD_TIMER] = INTER_WAVE_HOLD;
}
