// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildEffectSprite — effect-sequence step 0: spawn the hit effect sprite from the collided
 * object's record, then arm the effect countdown and its priority sound.
 *
 * It runs while the effect sequence is still at state 0, and consumes the record the board
 * collision search leaves behind — which hazard-object array was hit (COLLIDED_OBJECT_BASE), that
 * array's per-record stride (COLLIDED_OBJECT_STRIDE), and the hit record's index within it
 * (COLLIDED_OBJECT_INDEX). Four things happen:
 *
 *   1. Classify the array by the high byte of its base — i.e. by which memory page it lives on —
 *      and pick the matching group of source sprite records: one page selects
 *      OBJ_65A0_SPRITES, any lower page a second group that carries no shared name, and any
 *      higher page (the barrel array) ACTOR_SPRITES.
 *   2. Walk both records to the hit index — the object record by its own stride, the source
 *      sprite record by the fixed 4-byte sprite stride. An index of 0 leaves each at its base.
 *   3. Deactivate the object that was hit, then read its +0x15 field to pick the effect variant
 *      into EFFECT_SELECT: zero there selects 2, anything else selects 4.
 *   4. Build the EFFECT_SPRITE record out of the source record — take its +0 field (blanking that
 *      field in place, so the source sprite stops being drawn) and its +3 field, and stamp the
 *      fixed effect tile code and attribute — then advance the effect sequence one step, reload
 *      its inner and outer counters, and fire the priority sound for three frames.
 *
 * A LEAF: reads and writes memory only, calls nothing, returns nothing a caller consumes.
 *
 * LIVE-OUT: memory-only.
 */

import {
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

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function buildEffectSprite(m) {
  const { mem } = m;

  // Classify which hazard-object array the hit landed in by the base's high byte (its page),
  // and pick the source sprite-record group to build the effect sprite from.
  const arrayPage = mem.read8(COLLIDED_OBJECT_BASE + 1); // high byte of the 16-bit base
  let sourceBase;
  if (arrayPage === 0x65) sourceBase = OBJ_65A0_SPRITES; // page-0x65 array
  else if (arrayPage < 0x65) sourceBase = 0x69d0;   // a lower-page array
  else sourceBase = ACTOR_SPRITES;                  // a higher-page array (the barrels)

  // Walk both records to the hit index — the object record by its own stride, the source
  // sprite record by the fixed 4-byte stride. Index 0 leaves each at its base.
  const index = mem.read8(COLLIDED_OBJECT_INDEX);
  const stride = mem.read8(COLLIDED_OBJECT_STRIDE);
  const objRecord = (mem.read16(COLLIDED_OBJECT_BASE) + stride * index) & 0xffff;
  const sourceRecord = (sourceBase + 4 * index) & 0xffff;

  // Deactivate the object that was hit, then pick the effect variant from its +0x15 field.
  mem.write8((objRecord + OBJ_ACTIVE) & 0xffff, 0x00);
  const variant = mem.read8((objRecord + 0x15) & 0xffff) === 0 ? 2 : 4;
  mem.write8(EFFECT_SELECT, variant);

  // Build the effect sprite: take the source record's +0 field (and blank it in place),
  // stamp the fixed effect tile code and attribute, and copy the source record's +3 field.
  const field0 = mem.read8(sourceRecord);
  mem.write8(sourceRecord, 0x00);
  mem.write8(EFFECT_SPRITE + 0, field0);
  mem.write8(EFFECT_SPRITE + SPRITE_CODE, 0x60); // effect sprite tile code
  mem.write8(EFFECT_SPRITE + SPRITE_ATTR, 0x0c); // effect sprite colour/attribute
  mem.write8(EFFECT_SPRITE + 3, mem.read8((sourceRecord + 3) & 0xffff));

  // Advance the effect sequence and fire its priority sound for three frames.
  mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) + 1);
  mem.write8(EFFECT_SEQ_INNER, 6);
  mem.write8(EFFECT_SEQ_OUTER, 5);
  mem.write8(SND_PRIORITY, 6);
  mem.write8(SND_PRIORITY_FRAMES, 3);
}
