// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateEffectSpriteThenRearmEffect — effect-sequence step: a two-stage rate divider. An inner
 * counter drains once every twelve dispatches; on that beat it reloads and ticks an outer counter.
 * While the outer counter runs it increments the effect sprite's code byte (tile marches forward);
 * when it drains, it resets the sequence, re-arms the parent effect, and clears the cascade gate.
 *
 * LIVE-OUT: memory-only.
 */

import {
  EFFECT_SEQ_INNER,
  EFFECT_SEQ_OUTER,
  EFFECT_SEQ_STATE,
  EFFECT_STATE,
  EFFECT_PARAM_PTR,
  EFFECT_SPRITE,
  SPRITE_CODE,
} from "./names.js";

const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE;

export function animateEffectSpriteThenRearmEffect(m) {
  const { mem8, mem16 } = m;

  const inner = mem8[EFFECT_SEQ_INNER] - 1;
  mem8[EFFECT_SEQ_INNER] = inner;
  if (inner !== 0) return;

  mem8[EFFECT_SEQ_INNER] = 12;
  const outer = mem8[EFFECT_SEQ_OUTER] - 1;
  mem8[EFFECT_SEQ_OUTER] = outer;

  if (outer === 0) {
    mem8[EFFECT_SEQ_STATE] = 0; // back to the start of the effect-sequence dispatch
    mem8[0x6350] = 0; // the shared engine scratch that gates the per-frame cascade
    mem8[EFFECT_STATE] = 1; // re-arm the parent effect state machine
    mem16[EFFECT_PARAM_PTR] = EFFECT_SPRITE; // param pointer back to the sprite record base
    return;
  }

  mem8[EFFECT_SPRITE_CELL] = mem8[EFFECT_SPRITE_CELL] + 1;
}
