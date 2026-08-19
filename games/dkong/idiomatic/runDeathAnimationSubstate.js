// SPDX-License-Identifier: GPL-3.0-only
// runDeathAnimationSubstate: Mario's death-animation sub-state — service the effect-sprite state
// machine one frame, then tail-dispatch the death-animation phase (return forwarded). Memory-only.

import { dispatchDeathAnimationPhase } from "./dispatchDeathAnimationPhase.js";

const EFFECT_STATE_MACHINE = 0x1dbd;
const RESUME_AFTER_EFFECT_DISPATCH = 0x127f;

export function runDeathAnimationSubstate(m) {
  // Dispatch by address so the effect machine's arm/countdown handlers' guest `ret` pops the
  // bracket pushed here; a plain call left it unbalancing the guest stack (the barrel-jump reset).
  m.push16(RESUME_AFTER_EFFECT_DISPATCH);
  m.call(EFFECT_STATE_MACHINE);

  return dispatchDeathAnimationPhase(m);
}
