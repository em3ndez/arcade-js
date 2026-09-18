// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageObjectSpriteRecord — build the object's 4-byte deferral record, biasing its ends.
 * Where the tile-under-object classifier lands when the object sits on a solid, non-diggable
 * tile: it defers the frame, copying the object's probe block (column, sprite, middle, row)
 * into the record with the leading column byte biased down and the trailing row byte biased
 * up by the dip-switch bias; both biased ends wrap within a byte. Reads five bytes, writes
 * four, calls nothing. What downstream code does with the record is not pinned here.
 */

import { PLAYER_Y, PLAYER_FACING, PLAYER_X, PLAYER_SPRITE_ATTR, SPRITE_STAGING_BASE, SPRITE_COORD_BIAS } from "./names.js";

const RECORD = SPRITE_STAGING_BASE; // base of the 4-byte deferral record built for the object
const BIAS = SPRITE_COORD_BIAS; // the end-bias, held in the dip-switch parameter block

export function stageObjectSpriteRecord(m) {
  const { mem8 } = m;

  const bias = mem8[BIAS];

  // Copy the object's probe block into the record; each store truncates so the ends wrap.
  mem8[RECORD] = mem8[PLAYER_Y] - bias; // leading: column, bias removed
  mem8[RECORD + 1] = mem8[PLAYER_FACING];
  mem8[RECORD + 2] = mem8[PLAYER_SPRITE_ATTR];
  mem8[RECORD + 3] = mem8[PLAYER_X] + bias; // trailing: row, bias added
}
