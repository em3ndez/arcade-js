// SPDX-License-Identifier: GPL-3.0-only
// Stage 8 formation objects into the sprite shadow as a band of 3 then a band of 5, each object
// rendered at a fixed Y offset. Orientation bit0 flips the first band's offset (9 vs 7); the tail
// band settles at 8 either way.
import { renderObjectSprite } from "./renderObjectSprite.js";
import { loc_4018, SPRITE_SOURCE_OBJ_BASE, SPRITE_SHADOW_BASE } from "./names.js";

const OBJ_STRIDE = 32;    // bytes per source object record
const SPRITE_STRIDE = 4;  // bytes per staged sprite record

export function stageObjectsToSpriteShadow(m) {
  const flip = m.mem8[loc_4018] & 0x01;
  const firstOffset = flip ? 9 : 7;
  const tailOffset = firstOffset + (flip ? -1 : 1); // both orientations settle at 8

  const [obj, sprite] = stageBand(m, SPRITE_SOURCE_OBJ_BASE, SPRITE_SHADOW_BASE, 3, firstOffset);
  stageBand(m, obj, sprite, 5, tailOffset);
}

// Stage `rows` consecutive objects into consecutive sprite records at one shared Y offset;
// return the next [obj, sprite] so the bands chain contiguously.
function stageBand(m, obj, sprite, rows, yOffset) {
  for (let i = 0; i < rows; i++) {
    renderObjectSprite(m, obj, sprite, yOffset);
    obj += OBJ_STRIDE;
    sprite += SPRITE_STRIDE;
  }
  return [obj, sprite];
}
