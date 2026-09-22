// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickAwardTierByObjectCount — pick one of three award-popup parameter pairs from A's low bits
 * (first clear low bit wins), then tail into the Mario-anchored record-stamp routine; entered with
 * A already shifted right once:
 *   - bit 0 clear      -> DE = 1, B = 0x7B
 *   - else bit 1 clear -> DE = 3, B = 0x7D
 *   - else             -> DE = 5, B = 0x7F
 * DE is the deferred task message, B the effect sprite code; both feed the tail.
 * LIVE-OUT: memory-only — the enqueued task, the stamped sprite record, the sound gate.
 */

import { awardScorePopup } from "./awardScorePopup.js";

export function pickAwardTierByObjectCount(m, a = m.regs.a) {
  // Seat DE (the deferred-task message enqueueTask reads) and B (the effect-sprite code), then stamp.
  if ((a & 0x01) === 0) return void (m.regs.de = 1, m.regs.b = 0x7b, awardScorePopup(m));
  if ((a & 0x02) === 0) return void (m.regs.de = 3, m.regs.b = 0x7d, awardScorePopup(m));
  return void (m.regs.de = 5, m.regs.b = 0x7f, awardScorePopup(m));
}
