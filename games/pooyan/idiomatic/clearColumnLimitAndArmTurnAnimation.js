// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { TURN_COLUMN_LIMIT, ANIM_SCRIPT_4212 } from "./names.js";

/**
 * clearColumnLimitAndArmTurnAnimation — interior-entry arm: clear the turn-column limit, then point the actor at the
 * turn animation script and restart it. Tail-calls the set-animation primitive.
 *
 * LIVE-OUT: memory only — the turn-column limit and the record's animation fields.
 */
export function clearColumnLimitAndArmTurnAnimation(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[TURN_COLUMN_LIMIT] = 0x00;
  return setActorAnimation(m, rec, ANIM_SCRIPT_4212);
}
