// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ea0 — effect-sequence step 0: spawn the hit effect sprite from the collided
 * object's record, then arm the effect countdown and its priority sound.  ROM 0x1EA0.
 *
 * Reached as the index-0 arm of the effect-sequence router (dispatched while
 * EFFECT_SEQ_STATE is 0). It consumes the record left behind by the board collision
 * search — which hazard-object array was hit (COLLIDED_OBJECT_BASE), the array's per-record
 * stride (COLLIDED_OBJECT_STRIDE), and the hit record's index (COLLIDED_OBJECT_INDEX) —
 * and does four things:
 *
 *   1. Classify the array by the base's high byte (its memory page) and pick the matching
 *      source sprite-record group: page 0x65 -> 0x69B8, a lower page -> 0x69D0, a higher
 *      page (the barrel array) -> ACTOR_SPRITES (0x6980).
 *   2. Walk both the object record (by its own stride) and the source sprite record (by the
 *      fixed 4-byte stride) to the hit index; an index of 0 leaves each at its base.
 *   3. Deactivate the hit object (clear its active flag), then read its +0x15 field to pick
 *      the effect variant into EFFECT_SELECT (0 there -> 2, otherwise -> 4).
 *   4. Build the EFFECT_SPRITE record from the source record — copy its +0 field (blanking
 *      it in place) and its +3 field, and stamp the fixed effect tile code and attribute —
 *      then advance the effect sequence (EFFECT_SEQ_STATE++, reload EFFECT_SEQ_INNER/OUTER)
 *      and fire the priority sound for three frames.
 *
 * A LEAF: reads and writes memory only, calls nothing, returns nothing a caller consumes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1ea0.test.js.
 * GATE:     real captured 0x1EA0 dispatches from an attract run (the 0x6700 and 0x6400
 *           arms, index 0 and index 2-5) plus crafted entries that drive the third
 *           classifier arm (page 0x65 -> 0x69B8, never hit in attract) and both EFFECT_SELECT
 *           variants (the +0x15 field zero and nonzero). Teeth: an inverted variant test, a
 *           dropped classifier arm, and a wrong sequence-counter reload.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal return are
 *           dead ABI; nothing downstream reads them, and the routine writes no stack.
 * NAMES:    COLLIDED_OBJECT_BASE/STRIDE/INDEX (0x6351/0x6353/0x6354), OBJ_ACTIVE (+0),
 *           ACTOR_SPRITES (0x6980), EFFECT_SELECT (0x6342), EFFECT_SPRITE (0x6A2C) with
 *           SPRITE_CODE/SPRITE_ATTR field offsets, EFFECT_SEQ_STATE/INNER/OUTER
 *           (0x6345/0x6346/0x6347), SND_PRIORITY/SND_PRIORITY_FRAMES (0x608A/0x608B) — all
 *           from ram.js. Kept hex: the two unnamed source-record groups 0x69B8/0x69D0 (peers
 *           of the named 0x6980), the classifier page byte 0x65, and the object's +0x15 field.
 */

import {
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
} from "./ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function loc_1ea0(m) {
  const { mem } = m;

  // Classify which hazard-object array the hit landed in by the base's high byte (its page),
  // and pick the source sprite-record group to build the effect sprite from.
  const arrayPage = mem.read8(COLLIDED_OBJECT_BASE + 1); // high byte of the 16-bit base
  let sourceBase;
  if (arrayPage === 0x65) sourceBase = 0x69b8;      // page-0x65 array
  else if (arrayPage < 0x65) sourceBase = 0x69d0;   // a lower-page array
  else sourceBase = ACTOR_SPRITES;                  // a higher-page array (0x6980)

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
