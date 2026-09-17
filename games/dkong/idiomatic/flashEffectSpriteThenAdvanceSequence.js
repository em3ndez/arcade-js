// SPDX-License-Identifier: GPL-3.0-only
/**
 * flashEffectSpriteThenAdvanceSequence — effect-sequence step 1: a two-stage rate divider that
 * flips a sprite-shadow bit on most beats and advances the sequence on every fourth. The inner
 * counter drains once every six calls to a beat; on most beats it flips the effect sprite's
 * tile-code low bit, and on every fourth beat it advances the sequence state instead.
 *
 * LIVE-OUT: memory-only — the two dividers, the sequence state, and the flashed sprite cell.
 */

import { EFFECT_SEQ_INNER, EFFECT_SEQ_OUTER, EFFECT_SEQ_STATE, EFFECT_SPRITE, SPRITE_CODE } from "./names.js";

const EFFECT_SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE;

export function flashEffectSpriteThenAdvanceSequence(m) {
  const { mem8 } = m;

  const inner = mem8[EFFECT_SEQ_INNER] - 1;
  mem8[EFFECT_SEQ_INNER] = inner;
  if (inner !== 0) return;

  mem8[EFFECT_SEQ_INNER] = 6;
  const outer = mem8[EFFECT_SEQ_OUTER] - 1;

  if (outer === 0) {
    mem8[EFFECT_SEQ_OUTER] = 4;
    mem8[EFFECT_SEQ_STATE] = mem8[EFFECT_SEQ_STATE] + 1;
    return;
  }

  mem8[EFFECT_SEQ_OUTER] = outer;
  mem8[EFFECT_SPRITE_CELL] = mem8[EFFECT_SPRITE_CELL] ^ 0x01;
}
