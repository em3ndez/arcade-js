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

import { loc_1e28 } from "../translated/loc_1e28.js";

export function pickAwardTierByObjectCount(m, a = m.regs.a) {
  // The DE/B writes ride the return so the register bridge survives the frozen dispatch (void shape).
  if ((a & 0x01) === 0) return void (m.regs.de = 0x0001, m.regs.b = 0x7b, loc_1e28(m));
  if ((a & 0x02) === 0) return void (m.regs.de = 0x0003, m.regs.b = 0x7d, loc_1e28(m));
  return void (m.regs.de = 0x0005, m.regs.b = 0x7f, loc_1e28(m));
}
