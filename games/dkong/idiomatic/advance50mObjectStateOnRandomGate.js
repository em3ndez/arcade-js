// SPDX-License-Identifier: GPL-3.0-only
/**
 * advance50mObjectStateOnRandomGate — let a 50m board object move on to its next state, but only
 * on a randomly chosen frame, so it dwells an unpredictable length of time in this one.
 *
 * One arm of the small state machine a 50m board object is driven through each frame. The caller
 * picks which object's record to work on and hands over its base address; the state byte sits
 * right there, at the front of the record.
 *
 * The body is a randomised dwell. The shared random accumulator is sampled, and the object's
 * state is stepped on ONLY when four selected bits of it all happen to be clear — about one frame
 * in sixteen. On every other frame the gate is shut and the object simply stays where it is. The
 * effect is that the object holds this state for a random spell and then moves on, instead of
 * advancing on a fixed cadence, so its behaviour does not look metronomic.
 *
 * A LEAF: it reads the random byte, reads the state byte, writes the state byte when the gate
 * opens, and calls nothing.
 *
 * LIVE-OUT: memory-only — the one state byte, and only on the frames the gate opens.
 */

import { RANDOM } from "./names.js";

/**
 * @param {object} m           the machine (memory only).
 * @param {number} recordBase  address of the object's state byte — the record base the caller
 *                             chose for this frame.
 * @returns {void}
 */
export function advance50mObjectStateOnRandomGate(m, recordBase) {
  const { mem } = m;

  // The randomised gate: advance only when the four selected bits of the random
  // accumulator are all clear, about one frame in sixteen; otherwise linger.
  if ((mem.read8(RANDOM) & 0x3c) !== 0) return;

  // Gate open: step the object to its next state.
  mem.write8(recordBase, mem.read8(recordBase) + 1);
}
