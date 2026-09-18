// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedChamberCreature — seed the left-chamber creature and Pit sliding-floor-reveal parameters, the
 * first block of round/level setup, then hand off to seedEnemyRecords.
 *
 * The first half of the round/level parameter-seeding pass: it fills its own block of parameter and
 * counter bytes with fixed start values, derives a single animation-reload byte from the round's
 * difficulty counter, and tail-jumps into seedEnemyRecords, which seeds the second block. The reload
 * byte scales with difficulty — it increments LEVEL, holds it at a ceiling of four, and takes seven
 * minus that (6, 5, 4, then a floor of 3), so the floor reveal reloads sooner at harder levels.
 * Every write lands on a distinct byte, so their order does not affect the result. The hand-off is a
 * tail jump: seedEnemyRecords's return unwinds to this routine's caller, so the delegation is the exit.
 */

import { seedEnemyRecords } from "./seedEnemyRecords.js";

import {
  CHAMBER_CREATURE_ANIM_PHASE,
  CHAMBER_CREATURE_ATTR,
  CHAMBER_CREATURE_FRAME,
  CHAMBER_CREATURE_X,
  CHAMBER_CREATURE_FALL_Y,
  CHAMBER_CREATURE_X_VELOCITY,
  CHAMBER_CREATURE_FALL_STEP,
  GOAL_TILE_LATCH,
  LEVEL,
  PIT_FLOOR_REVEAL_CURSOR,
  PIT_FLOOR_REVEAL_GATE,
  PIT_FLOOR_REVEAL_PERIOD,
} from "./names.js";
export function seedChamberCreature(m) {
  const { mem8 } = m;

  // Fixed start values for the parameter/counter block.
  mem8[CHAMBER_CREATURE_X] = 40;
  mem8[CHAMBER_CREATURE_FRAME] = 57;
  mem8[CHAMBER_CREATURE_ATTR] = 192;
  mem8[CHAMBER_CREATURE_FALL_Y] = 120;
  mem8[CHAMBER_CREATURE_X_VELOCITY] = 1;
  mem8[CHAMBER_CREATURE_FALL_STEP] = 252;
  mem8[CHAMBER_CREATURE_ANIM_PHASE] = 1;
  mem8[PIT_FLOOR_REVEAL_GATE] = 1;
  mem8[PIT_FLOOR_REVEAL_CURSOR] = 150;
  mem8[GOAL_TILE_LATCH] = 0;

  // Reveal-period byte, scaled by difficulty. Increment the round's
  // level/difficulty counter (wrapping in one byte), hold it at a ceiling of four,
  // and take seven minus that. As the level rises the period steps down 6, 5, 4 and
  // then floors at 3 — a shorter reveal cadence at harder levels.
  const cappedLevel = Math.min((mem8[LEVEL] + 1) & 0xff, 4);
  mem8[PIT_FLOOR_REVEAL_PERIOD] = 7 - cappedLevel;

  // Tail hand-off into seedEnemyRecords; its return goes to our caller, so this is
  // seedChamberCreature's exit.
  return seedEnemyRecords(m);
}
