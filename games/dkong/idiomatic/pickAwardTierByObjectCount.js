// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickAwardTierByObjectCount — pick one of three award-popup parameter pairs from the low bits
 * of A (a "first clear low bit wins" priority encoder), then tail-jump into the Mario-anchored
 * record-stamp routine. Reached with A already shifted right once:
 *
 *   - A bit 0 clear      -> (DE = 1, B = 0x7B)
 *   - else A bit 1 clear -> (DE = 3, B = 0x7D)
 *   - else               -> (DE = 5, B = 0x7F)
 *
 * DE is the deferred task message and B the effect sprite's code byte; both are the tail's
 * inputs. A is deliberately not rotated — the tail re-derives A and the flags from memory.
 *
 * LIVE-OUT: memory-only — the enqueued task, the stamped sprite record, and the sound gate,
 * all written by the tail.
 */

import { loc_1e28 } from "../translated/loc_1e28.js";

export function pickAwardTierByObjectCount(m, a = m.regs.a) {
  const { regs } = m;

  if ((a & 0x01) === 0) {
    regs.de = 0x0001;
    regs.b = 0x7b;
  } else if ((a & 0x02) === 0) {
    regs.de = 0x0003;
    regs.b = 0x7d;
  } else {
    regs.de = 0x0005;
    regs.b = 0x7f;
  }

  loc_1e28(m);
}
