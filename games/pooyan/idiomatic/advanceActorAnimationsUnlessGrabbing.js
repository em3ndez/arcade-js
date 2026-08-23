// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorAnimationFrame } from "./advanceActorAnimationFrame.js";
import { ACTOR_TABLE, GRAB_ACTIVE_FLAG } from "./names.js";
/**
 * advanceActorAnimationsUnlessGrabbing — step the animation script of four actor records, unless a rope-grab is in progress.
 *
 * While the grab latch is clear, runs the per-actor stepper over four fixed records one stride
 * apart, starting at the actor table. A set grab latch skips the whole pass.
 *
 * LIVE-OUT: on the run path IX = the fourth record and DE = the record stride — the loop's own
 * residue (the stepper leaves both untouched); both bridged. Nothing survives on the skip path.
 */
const RECORD_COUNT = 4;
const RECORD_STRIDE = 0x18;

export function advanceActorAnimationsUnlessGrabbing(m) {
  const { mem8 } = m;
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return; // grab in progress -> skip the pass

  let rec = ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    advanceActorAnimationFrame(m, rec);
    if (i < RECORD_COUNT - 1) rec = u16(rec + RECORD_STRIDE);
  }
  return [(m.regs.ix = rec), (m.regs.de = RECORD_STRIDE)];
}
