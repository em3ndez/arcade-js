// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { TURN_COLUMN_LIMIT, ANIM_SCRIPT_4203 } from "./names.js";
/**
 * loc_425c — arm an actor's turn animation from an interior entry point.
 *
 * Latches the turn-column limit flag on, then points the actor record at the fixed
 * turn-animation script and restarts it through the shared set-animation tail.
 *
 * LIVE-OUT: memory only (the flag plus the record's animation pointer/frame index); the
 * animation-arm callers consume no register.
 */

const TURN_ARMED = 0xff; // sentinel stored into the turn-column limit flag

export function loc_425c(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[TURN_COLUMN_LIMIT] = TURN_ARMED;
  setActorAnimation(m, rec, ANIM_SCRIPT_4203);
}
