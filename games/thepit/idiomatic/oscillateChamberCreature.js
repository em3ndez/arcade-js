// SPDX-License-Identifier: GPL-3.0-only
/**
 * oscillateChamberCreature — step the chamber creature's position for one on-beat frame: bounce it
 * sideways within a fixed band, accelerate its fall-Y until it hits the floor and RNG-resets, then
 * hand off to the sprite publish. The animation clock reaches this only on the frames the creature
 * actually moves; off-beat frames go straight to publish. The return is the publish tail's.
 */

import { advanceRandom } from "./advanceRandom.js";
import { publishChamberCreatureSprite } from "./publishChamberCreatureSprite.js";
import { u8 } from "../../../core/int.js";
import {
  CHAMBER_CREATURE_ATTR,
  CHAMBER_CREATURE_FALL_STEP,
  CHAMBER_CREATURE_FALL_Y,
  CHAMBER_CREATURE_X,
  CHAMBER_CREATURE_X_VELOCITY,
} from "./names.js";

// The bounce band and the fall floor (element-local pixels).
const RIGHT_WALL = 56; // at or past this, step left
const LEFT_WALL = 25; // below this, step right
const STEP_LEFT = 255; // velocity byte for a leftward step (-1)
const STEP_RIGHT = 1; // velocity byte for a rightward step (+1)
const FLOOR_Y = 134; // Y clamps here when the fall reaches the floor

export function oscillateChamberCreature(m) {
  const { mem8 } = m;

  // Horizontal bounce: reverse velocity at each wall, hold it mid-band.
  const velocity = mem8[CHAMBER_CREATURE_X_VELOCITY];
  const newX = u8(mem8[CHAMBER_CREATURE_X] + velocity);
  mem8[CHAMBER_CREATURE_X] = newX;
  if (newX >= RIGHT_WALL) mem8[CHAMBER_CREATURE_X_VELOCITY] = STEP_LEFT;
  else if (newX < LEFT_WALL) mem8[CHAMBER_CREATURE_X_VELOCITY] = STEP_RIGHT;

  // Vertical fall: accelerate each frame; at the floor, clamp, draw a fresh random step, and
  // advance colour with the priority bit held clear.
  const fallStep = mem8[CHAMBER_CREATURE_FALL_STEP] + 1;
  mem8[CHAMBER_CREATURE_FALL_STEP] = fallStep;
  const newY = u8(mem8[CHAMBER_CREATURE_FALL_Y] + fallStep);
  mem8[CHAMBER_CREATURE_FALL_Y] = newY;
  if (newY >= FLOOR_Y) {
    mem8[CHAMBER_CREATURE_FALL_Y] = FLOOR_Y;
    mem8[CHAMBER_CREATURE_FALL_STEP] = (advanceRandom(m) | 0xf8) - 1;
    mem8[CHAMBER_CREATURE_ATTR] = (mem8[CHAMBER_CREATURE_ATTR] + 1) & 0xf7;
  }

  // Fall through into the sprite publish; its return is ours.
  return publishChamberCreatureSprite(m);
}
