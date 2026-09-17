// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDeathAnimation — the cycling arm of Mario's death animation: on each 8-frame gate
 * tick, step his sprite to the next of four orientations; when the tick counter runs out, settle
 * the sprite on a fixed tile and advance the phase.
 *
 * LIVE-OUT: memory-only.
 */

import { SUBSTATE_TIMER, MARIO_SPRITE_RECORD, DEATH_ANIM_PHASE, DEATH_ANIM_TICKS_LEFT } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // bit 7 = vertical mirror flag
const SPRITE_ATTR = MARIO_SPRITE_RECORD + 2; // bit 7 = horizontal mirror flag

export function stepMarioDeathAnimation(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  mem8[SUBSTATE_TIMER] = 0x08;

  const remaining = (mem8[DEATH_ANIM_TICKS_LEFT] - 1) & 0xff;
  mem8[DEATH_ANIM_TICKS_LEFT] = remaining;
  if (remaining === 0) {
    advancePhase(m);
    return;
  }

  // Mask carries the flip bit (bit 0, always set) and the code's OLD bit 0 in bit 7, so XORing
  // it toggles bit 0 every tick and the vertical mirror flag only when bit 0 falls back to 0.
  const code = mem8[SPRITE_CODE];
  const b = ((code & 0x01) << 7) | 0x01;
  mem8[SPRITE_CODE] = b ^ code;
  // The horizontal mirror flag flips on that same tick, so both mirror flags swap together.
  mem8[SPRITE_ATTR] = (b & 0x80) ^ mem8[SPRITE_ATTR];
}

/**
 * The settle tail, reached only when the tick count hits zero: leave Mario on a fixed tile with
 * his mirror flag preserved, advance the phase, and re-arm the gate long so the next arm waits.
 */
function advancePhase(m) {
  const { mem8 } = m;

  const code = mem8[MARIO_SPRITE_RECORD + 1];
  mem8[MARIO_SPRITE_RECORD + 1] = (code & 0x80) | 0x7a; // keep old mirror bit, settle tile

  mem8[DEATH_ANIM_PHASE] = (mem8[DEATH_ANIM_PHASE] + 1) & 0xff;
  mem8[SUBSTATE_TIMER] = 0x80;
}
