// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginMarioDeathAnimation — the seed arm of Mario's death animation: point his sprite at the
 * first death tile, prime the 13-tick counter, clear sprite runs, fire the death sound line, then
 * advance the phase. Gated by the sub-state timer, so it acts only on the frame that gate expires.
 *
 * LIVE-OUT: memory-only — Mario's sprite-code byte, DEATH_ANIM_PHASE, DEATH_ANIM_TICKS_LEFT,
 * SUBSTATE_TIMER, the cleared sprite runs and SND_IRQ_TRIGGER.
 */

import {
  SUBSTATE_TIMER,
  MARIO_SPRITE_RECORD,
  SND_IRQ_TRIGGER,
  DEATH_ANIM_PHASE,
  DEATH_ANIM_TICKS_LEFT,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loc_30bd } from "../translated/loc_30bd.js";

const SPRITE_CODE = MARIO_SPRITE_RECORD + 1;

export function beginMarioDeathAnimation(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  // Rewrite the sprite-code byte to tile 0x78, keeping its old bit 7 (Mario's facing flag).
  const code = mem8[SPRITE_CODE];
  mem8[SPRITE_CODE] = (code & 0x80) | 0x78;

  mem8[DEATH_ANIM_PHASE] = (mem8[DEATH_ANIM_PHASE] + 1) & 0xff;
  mem8[DEATH_ANIM_TICKS_LEFT] = 0x0d;
  mem8[SUBSTATE_TIMER] = 0x08;

  loc_30bd(m);

  mem8[SND_IRQ_TRIGGER] = 0x03;
}
