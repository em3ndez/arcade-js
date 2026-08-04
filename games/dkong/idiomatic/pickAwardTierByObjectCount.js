// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickAwardTierByObjectCount — pick one of three award-popup parameter pairs from the low bits
 * of A, then hand off to the Mario-anchored record-stamp tail.
 *
 * A setter in the effect-sprite state machine, and the direct sibling of the three
 * fixed-value award setters — each loads its own (DE, B) and tail-jumps into the same stamp
 * routine. It is reached with A holding the award-selection byte already shifted right once,
 * and is a small priority encoder over A's two low bits:
 *
 *   - A bit 0 clear            -> (DE = 1, B = 0x7B)
 *   - else A bit 1 clear       -> (DE = 3, B = 0x7D)
 *   - else                     -> (DE = 5, B = 0x7F)
 *
 * "First clear low bit wins" is exactly this if/else-if chain. B and E are correlated:
 * B = E + 0x7A. DE is the deferred task message (D = opcode 0, E = argument 1/3/5) and B is
 * the effect sprite's code byte; both are the tail's parameters. The tail then enqueues the
 * task, stamps a 4-byte sprite record anchored on Mario's position, and cues a board-gated
 * sound.
 *
 * A is deliberately NOT rotated here even though the bit walk conceptually consumes it: the
 * tail re-derives both A and the condition flags from memory before anything reads them, so
 * the rotation would be invisible.
 *
 * LIVE-OUT: memory-only — the enqueued task, the stamped sprite record, and the sound gate,
 * all written by the tail. DE and B are set purely as that tail's inputs and are consumed
 * within this same dispatch.
 */
// The tail performs this routine's return on its behalf, so control leaves through it rather
// than by returning from here.
import { loc_1e28 } from "../translated/loc_1e28.js";

export function pickAwardTierByObjectCount(m) {
  const { regs } = m;

  // First clear low bit of A selects the (DE, B) parameter pair.
  if ((regs.a & 0x01) === 0) {
    regs.de = 0x0001;
    regs.b = 0x7b;
  } else if ((regs.a & 0x02) === 0) {
    regs.de = 0x0003;
    regs.b = 0x7d;
  } else {
    regs.de = 0x0005;
    regs.b = 0x7f;
  }

  // Tail into the Mario-anchored task-enqueue + record-stamp.
  loc_1e28(m);
}
