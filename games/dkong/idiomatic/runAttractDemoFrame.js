// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractDemoFrame — write this frame's scripted attract-demo input over the cooked player
 * input, then run the shared per-frame update cascade, which reads that control word as if a
 * joystick had produced it.
 *
 * The order is the whole of this routine's behaviour and the only thing in it that can be wrong:
 * run the cascade first and it consumes the previous frame's input instead of this one's. The
 * cascade's return value is propagated unchanged.
 */

import { runGameplayFrame } from "./runGameplayFrame.js";
import { advanceAttractDemoInput } from "./advanceAttractDemoInput.js";

export function runAttractDemoFrame(m) {
  advanceAttractDemoInput(m);

  return runGameplayFrame(m);
}
