// SPDX-License-Identifier: GPL-3.0-only
/**
 * mirrorObjectPositionToSprite — copy the object record's X and Y (at the object-scan cursor)
 * into its paired sprite record (at the sprite-scan cursor), then fall into the shared cursor
 * advance to step both scan cursors to the next object.
 *
 * LIVE-OUT: those two writes, plus the registers the shared advance leaves — object cursor +16,
 * sprite cursor +4, remaining-object count preserved, step value 4.
 */

import { OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y } from "./names.js";
import { advanceToNextObject } from "./advanceToNextObject.js";

export function mirrorObjectPositionToSprite(m) {
  const { regs, mem8 } = m;

  mem8[regs.iy + SPRITE_X] = mem8[regs.ix + OBJ_X];
  mem8[regs.iy + SPRITE_Y] = mem8[regs.ix + OBJ_Y];

  advanceToNextObject(m);
}
