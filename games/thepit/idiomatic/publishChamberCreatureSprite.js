// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishChamberCreatureSprite — write the chamber creature's four screen-relative sprite bytes into
 * its staging slot (X and Y shifted by the cabinet coordinate bias, tile and colour verbatim), then
 * hand off to the object-record pass. The return is that pass's.
 */

import { updateEnemy1 } from "./updateEnemy1.js";
import {
  CHAMBER_CREATURE_ATTR,
  CHAMBER_CREATURE_FALL_Y,
  CHAMBER_CREATURE_FRAME,
  CHAMBER_CREATURE_SPRITE,
  CHAMBER_CREATURE_X,
  SPRITE_COORD_BIAS,
} from "./names.js";

export function publishChamberCreatureSprite(m) {
  const { mem8 } = m;
  const bias = mem8[SPRITE_COORD_BIAS]; // cabinet coordinate bias (0 in normal play)
  mem8[CHAMBER_CREATURE_SPRITE] = mem8[CHAMBER_CREATURE_X] - bias;
  mem8[CHAMBER_CREATURE_SPRITE + 1] = mem8[CHAMBER_CREATURE_FRAME];
  mem8[CHAMBER_CREATURE_SPRITE + 2] = mem8[CHAMBER_CREATURE_ATTR];
  mem8[CHAMBER_CREATURE_SPRITE + 3] = mem8[CHAMBER_CREATURE_FALL_Y] + bias;

  // Hand off to the object-record pass; its return is our exit.
  return updateEnemy1(m);
}
