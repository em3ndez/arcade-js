// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829 } from "./names.js";
/**
 * loc_141c — gate an actor's spawn/queue step on its phase field.
 *
 * If the actor's phase byte (rec+6) has already reached 2 or more, the routine leaves the
 * record untouched. Otherwise it clears the (rec+8) field and points the record at the
 * animation sequence table, restarting the animation.
 *
 * LIVE-OUT: memory only — either nothing (the gate hit) or (rec+8) plus the three
 * animation-pointer bytes written by the animation helper (rec+0x0C..rec+0x0E).
 */

const PHASE_ADVANCED_LIMIT = 0x02; // (rec+6) at/above this: already advanced, skip

export function loc_141c(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (mem8[rec + 0x06] >= PHASE_ADVANCED_LIMIT) return;
  mem8[rec + 0x08] = 0x00;
  setActorAnimation(m, rec, ANIM_TABLE_3829);
}
