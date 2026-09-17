// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBoardObjects — service the six board objects for one pass (advance, then spawn), then
 * publish each object's X and Y into its 4-byte sprite record in the sprite shadow buffer.
 *
 * LIVE-OUT: memory-only — the six object records and the six published sprite records inside
 * SPRITE_BUFFER.
 */

import { OBJ_ARRAY_66, OBJ_X, OBJ_Y, SPRITE_BUFFER } from "./names.js";
import { advanceBoardObjectTravel } from "./advanceBoardObjectTravel.js";
import { spawnBoardObject } from "./spawnBoardObject.js";

const RECORD_COUNT = 6;
const OBJ_STRIDE = 16;
const SPRITE_STRIDE = 4;
const PUBLISH_BASE = SPRITE_BUFFER + 88;
const SPRITE_Y = 3;

export function serviceBoardObjects(m) {
  const { mem8 } = m;

  advanceBoardObjectTravel(m);
  spawnBoardObject(m);

  let src = OBJ_ARRAY_66;
  let dst = PUBLISH_BASE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    mem8[dst] = mem8[src + OBJ_X];
    mem8[dst + SPRITE_Y] = mem8[src + OBJ_Y];
    dst += SPRITE_STRIDE;
    src += OBJ_STRIDE;
  }
}
