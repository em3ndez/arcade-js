// SPDX-License-Identifier: GPL-3.0-only
// runDeathAnimationSubstate: Mario's death-animation sub-state — service the effect-sprite state
// machine one frame, then tail-dispatch the death-animation phase (return forwarded). Memory-only.

import { dispatchDeathAnimationPhase } from "./dispatchDeathAnimationPhase.js";
import { dispatchEffectState } from "./dispatchEffectState.js";

export function runDeathAnimationSubstate(m) {
  dispatchEffectState(m);

  return dispatchDeathAnimationPhase(m);
}
