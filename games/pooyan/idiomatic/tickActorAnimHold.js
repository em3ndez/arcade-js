// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * tickActorAnimHold — advance one actor's animation-hold countdown for the record at IX.
 *
 * On timer underflow it steps the 2-bit phase and re-arms while phase remains, disarming at
 * phase end. Gate and step conditions are inline.
 *
 * LIVE-OUT: memory-only — mutates the handed record; nothing is returned or read back.
 */
export function tickActorAnimHold(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Gate: proceed only for a per-record animate bit, else only on even rounds.
  if ((mem8[rec + 0x0b] & 0x01) === 0 && (mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  if ((mem8[rec + 0x00] & 0x01) === 0) return; // record inactive
  if ((mem8[rec + 0x16] & 0x02) === 0) return; // not armed

  const timer = u8(mem8[rec + 0x12] - 1);
  mem8[rec + 0x12] = timer;
  if (timer !== 0) return; // hold still running

  const phase = mem8[rec + 0x13] & 0x03;
  if (phase === 0) {
    mem8[rec + 0x16] = 0x00; // phase exhausted -> disarm
    return;
  }
  mem8[rec + 0x13] = phase - 1; // step the phase down
  mem8[rec + 0x16] = 0x01;      // re-arm for the next step
}
