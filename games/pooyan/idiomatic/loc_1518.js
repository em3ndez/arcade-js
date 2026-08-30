// SPDX-License-Identifier: GPL-3.0-only
import {
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD3_VRAM_ALT,
  SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";

/**
 * loc_1518 — per-frame object update with a phase-advance step.
 *
 * Steps the object's animation, then counts down its frame timer; while the timer is still
 * running (the common case) it returns. On expiry it optionally redraws a HUD field — a nonzero
 * (doubled) selector value is converted to packed BCD and drawn as stacked digits, with the
 * hundreds tally written to its own cell only when nonzero. It then advances the object's phase:
 * at the final phase it tail-delegates to the turn-animation arm; otherwise it writes the next
 * phase, reloads the frame timer to 1, bumps the state byte, re-steps the animation, and — as the
 * reloaded timer drains to zero — tail-delegates to the sprite-band blank.
 *
 * LIVE-OUT: memory only — the record fields, the HUD cells, and whatever the tail delegates write.
 */

const FRAME_TIMER = 0x11; //   record: per-frame countdown timer
const STATE_FIELD = 0x02; //   record: state byte, bumped on a phase advance
const PHASE = 0x16; //         record: current phase, compared against the final phase
const NEXT_PHASE = 0x13; //    record: advanced phase written on a step
const FINAL_PHASE = 0x07;

export function loc_1518(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);
  mem8[rec + FRAME_TIMER] = mem8[rec + FRAME_TIMER] - 1; // write wraps to a byte
  if (mem8[rec + FRAME_TIMER] !== 0) return; // timer still running — most frames end here

  const selector = (mem8[SUBSTATE_FIELD3_VALUE] << 1) & 0xff;
  if (selector !== 0) {
    const { a: digits, hundreds } = binToPackedBcd(m, selector);
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM_ALT] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM_ALT, digits);
  }

  const phase = mem8[rec + PHASE];
  if (phase === FINAL_PHASE) return armEnemyTurnAnimation(m, rec); // final phase: enter turn anim

  mem8[rec + NEXT_PHASE] = phase + 1;
  mem8[rec + FRAME_TIMER] = 0x01;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;

  advanceObjectAnimationFrame(m, rec);
  mem8[rec + FRAME_TIMER] = mem8[rec + FRAME_TIMER] - 1;
  if (mem8[rec + FRAME_TIMER] !== 0) return;

  return blankActorSpriteBand(m, rec);
}
