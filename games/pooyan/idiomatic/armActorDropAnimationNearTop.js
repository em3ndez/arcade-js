// SPDX-License-Identifier: GPL-3.0-only
import { DROP_ANIM_DESCRIPTOR } from "./names.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * armActorDropAnimationNearTop — arm the drop animation when the actor is near the top of its travel.
 *
 * Only acts when the incoming high-position byte is below 2; then it seats the drop-animation
 * pointer into the record, marks the actor's sub-state as dropping, and reloads its phase timer.
 *
 * LIVE-OUT: memory only — the record fields at IX (+0x0c..0x0e for the animation, +0x02, +0x11).
 */
const DROP_SUBSTATE = 0x02; // sub-state marking the actor as dropping
const DROP_TIMER = 0x28; // phase-timer reload for the drop

export function armActorDropAnimationNearTop(m, highPos = m.regs.b, rec = m.regs.ix) {
  const { mem8 } = m;
  if (highPos >= 0x02) return;

  setActorAnimation(m, rec, DROP_ANIM_DESCRIPTOR); // seat the drop animation into the record

  mem8[rec + 0x02] = DROP_SUBSTATE;
  mem8[rec + 0x11] = DROP_TIMER;
}
