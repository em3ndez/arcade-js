// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import {
  loc_8d45,
  ANIM_SEQ_TABLE_1557,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD3_VRAM_ALT,
  SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT,
} from "./names.js";

/**
 * loc_14dc — launch/hunter state-1 handler for one actor record.
 *
 * Setup: pick an animation index and a countdown. When the global level byte is live and the
 * record's select field is not 0xff, clamp the level to 4, fold its bit into the packed field,
 * bump the neighbouring counter, and use a long countdown; otherwise use the record's own index
 * with a short countdown. Install the chosen sequence and advance the sub-state.
 *
 * Each following frame it steps the animation and counts the countdown down; while it is still
 * running it returns. On expiry it renders the doubled packed field as a stacked-BCD HUD number
 * (with a hundreds digit when present), then either arms the turn animation (at select 7) or bumps
 * the select, reloads a one-frame countdown, and advances to the retire step. That retire step
 * steps the animation once more and, on its expiry, blanks the record's sprite band.
 *
 * LIVE-OUT: memory only — the record fields, the packed/counter cells, and the HUD digit cells.
 * No register output the caller reads.
 */

const REC_STATE = 0x02; //   sub-state index
const REC_COUNTDOWN = 0x11; // frame/timer countdown
const REC_SELECT = 0x12; //  animation-select field
const REC_TURN = 0x13; //    turn/select store
const REC_PHASE = 0x16; //   phase field (7 => turn animation)
const REC_INDEX = 0x17; //   default animation index
const LEVEL_MAX = 0x04; //   level clamp ceiling
const LONG_COUNT = 0x38; //  masked-path countdown

export function loc_14dc(m, rec = m.regs.ix) {
  const { mem8 } = m;

  let count = 0x01;
  let animIndex = mem8[rec + REC_INDEX];
  const level = mem8[loc_8d45];

  if (level !== 0) {
    const bumped = (mem8[rec + REC_SELECT] + 1) & 0xff;
    if (bumped === 0) {
      animIndex = bumped; // select was 0xff -> index 0
    } else {
      const clamped = level < 0x05 ? level : LEVEL_MAX;
      animIndex = clamped - 1;
      const mask = 1 << (clamped - 1);
      mem8[SUBSTATE_FIELD3_VALUE] = mem8[SUBSTATE_FIELD3_VALUE] + mask;
      mem8[SUBSTATE_FIELD2_VALUE] = mem8[SUBSTATE_FIELD2_VALUE] + 1;
      count = LONG_COUNT;
    }
  }

  // Install the chosen sequence and advance the sub-state.
  mem8[rec + REC_COUNTDOWN] = count;
  const animPtr = loc_0c45(m, animIndex, ANIM_SEQ_TABLE_1557);
  setActorAnimation(m, rec, animPtr);
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;

  // Per-frame: step the animation, count down; still running -> return.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + REC_COUNTDOWN] = mem8[rec + REC_COUNTDOWN] - 1;
  if (mem8[rec + REC_COUNTDOWN] !== 0) return;

  // Countdown expired: render the doubled packed field as a stacked-BCD HUD number.
  const doubled = (mem8[SUBSTATE_FIELD3_VALUE] << 1) & 0xff;
  if (doubled !== 0) {
    const { a: digits, hundreds } = binToPackedBcd(m, doubled);
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM_ALT, digits);
  }

  // At the turn phase, arm the turn animation and finish here.
  const phase = mem8[rec + REC_PHASE];
  if (phase === 0x07) return armEnemyTurnAnimation(m, rec);

  // Otherwise bump the select, reload a one-frame countdown, advance to the retire step.
  mem8[rec + REC_TURN] = phase + 1;
  mem8[rec + REC_COUNTDOWN] = 0x01;
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;

  // Retire step: one more animation tick, then blank the sprite band on expiry.
  advanceObjectAnimationFrame(m, rec);
  mem8[rec + REC_COUNTDOWN] = mem8[rec + REC_COUNTDOWN] - 1;
  if (mem8[rec + REC_COUNTDOWN] !== 0) return;
  return blankActorSpriteBand(m, rec);
}
