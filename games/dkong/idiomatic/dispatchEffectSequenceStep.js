// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectSequenceStep — router for the effect-sequence step machine in EFFECT_SEQ_STATE:
 * hand the frame to step 0/1/2's handler; any other value runs off the table and raises.
 *
 * The step is selected by the low seven bits: the hardware's slot arithmetic wraps at eight bits,
 * so state and state+128 alias the same step (unreachable in play, but faithful).
 *
 * LIVE-OUT: memory-only, all written by the chosen handler.
 */

import { EFFECT_SEQ_STATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { buildEffectSprite } from "./buildEffectSprite.js";
import { flashEffectSpriteThenAdvanceSequence } from "./flashEffectSpriteThenAdvanceSequence.js";
import { animateEffectSpriteThenRearmEffect } from "./animateEffectSpriteThenRearmEffect.js";

const STEPS = [
  buildEffectSprite, // step 0 — build the sprite, cue its sound, advance to step 1
  flashEffectSpriteThenAdvanceSequence, // step 1 — flash the tile, advance after four beats
  animateEffectSpriteThenRearmEffect, // step 2 — march the tile, then tear down and re-arm
];

export function dispatchEffectSequenceStep(m) {
  const { mem8 } = m;
  const state = mem8[EFFECT_SEQ_STATE];

  const step = STEPS[state & 0x7f];
  if (step) return step(m);

  throw new NotImplemented(
    `dispatchEffectSequenceStep: EFFECT_SEQ_STATE (0x6345) step ${state} runs off the end of the three-entry step ` +
      `table and transfers to a garbage address; only steps 0-2 (and their +128 aliases) exist.`,
  );
}
