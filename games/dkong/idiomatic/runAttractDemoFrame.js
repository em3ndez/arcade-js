// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractDemoFrame — issue the attract demo's scripted input for this frame, then run the
 * shared per-frame update cascade.
 *
 * Two steps and nothing else, in that order. The first writes this frame's canned control word
 * over the cooked player input; the cascade then runs the same per-frame update a played game
 * runs, and reads that control word as if a joystick had produced it. The order is the whole of
 * this routine's behaviour and the only thing in it that can be wrong — run the cascade first
 * and it consumes the previous frame's input instead of this one's.
 *
 * WHAT THE NAME RESTS ON, from this body alone: the cascade is shared, so the only thing this
 * routine adds to it is the scripted-input step. A demo frame is an ordinary frame whose input
 * was canned rather than read from a player.
 *
 * LIVE-OUT: memory-only, plus the cascade's return value propagated unchanged. This routine
 * reads and writes no memory of its own.
 */

import { advanceAttractDemoInput } from "./advanceAttractDemoInput.js";

export function runAttractDemoFrame(m) {
  // The demo's input for this frame has to land before the cascade reads it.
  advanceAttractDemoInput(m);

  // The shared per-frame update cascade.
  return m.call(0x197a);
}
