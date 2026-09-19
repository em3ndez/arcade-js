// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildEffectSprite — effect-sequence step 0: spawn the hit effect sprite from the collided
 * object's record, then arm the effect countdown and its priority sound. A leaf that reads
 * and writes memory only.
 *
 * LIVE-OUT: memory-only.
 */

import {
  FIRE_SPRITES,
  OBJ_65A0_SPRITES,
  COLLIDED_OBJECT_BASE,
  COLLIDED_OBJECT_STRIDE,
  COLLIDED_OBJECT_INDEX,
  ACTOR_SPRITES,
  OBJ_ACTIVE,
  EFFECT_SELECT,
  EFFECT_SPRITE,
  SPRITE_CODE,
  SPRITE_ATTR,
  EFFECT_SEQ_STATE,
  EFFECT_SEQ_INNER,
  EFFECT_SEQ_OUTER,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";

export function buildEffectSprite(m) {
  const { mem8, mem16 } = m;

  const arrayPage = mem8[COLLIDED_OBJECT_BASE + 1]; // high byte of the 16-bit base
  let sourceBase;
  if (arrayPage === 0x65) sourceBase = OBJ_65A0_SPRITES; // page-0x65 array
  else if (arrayPage < 0x65) sourceBase = FIRE_SPRITES;   // a lower-page array
  else sourceBase = ACTOR_SPRITES;                  // a higher-page array (the barrels)

  const index = mem8[COLLIDED_OBJECT_INDEX];
  const stride = mem8[COLLIDED_OBJECT_STRIDE];
  const objRecord = (mem16[COLLIDED_OBJECT_BASE] + stride * index) & 0xffff;
  const sourceRecord = (sourceBase + 4 * index) & 0xffff;

  mem8[(objRecord + OBJ_ACTIVE) & 0xffff] = 0x00;
  const variant = mem8[(objRecord + 0x15) & 0xffff] === 0 ? 2 : 4;
  mem8[EFFECT_SELECT] = variant;

  const field0 = mem8[sourceRecord];
  mem8[sourceRecord] = 0x00;
  mem8[EFFECT_SPRITE + 0] = field0;
  mem8[EFFECT_SPRITE + SPRITE_CODE] = 0x60; // effect sprite tile code
  mem8[EFFECT_SPRITE + SPRITE_ATTR] = 0x0c; // effect sprite colour/attribute
  mem8[EFFECT_SPRITE + 3] = mem8[(sourceRecord + 3) & 0xffff];

  mem8[EFFECT_SEQ_STATE] = mem8[EFFECT_SEQ_STATE] + 1;
  mem8[EFFECT_SEQ_INNER] = 6;
  mem8[EFFECT_SEQ_OUTER] = 5;
  mem8[SND_PRIORITY] = 6;
  mem8[SND_PRIORITY_FRAMES] = 3;
}
