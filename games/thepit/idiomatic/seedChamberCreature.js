// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedChamberCreature — seed the left-chamber creature + Pit sliding-floor-reveal parameters (the
 * first block of round/level setup), derive the reveal-period byte, then hand off to
 * seedEnemyRecords.  ROM 0x2f2f. (§2.8)
 *
 * The first half of the round/level parameter-seeding pass: it fills its own block
 * of subsystem parameter/counter bytes with fixed start values, then derives a
 * single animation-reload byte from the round's level/difficulty counter and jumps
 * straight into seedEnemyRecords, which seeds the second block. The reload byte counts down
 * as difficulty climbs: it increments the counter, holds it at a ceiling of four,
 * and takes seven minus that — 6, 5, 4, then a floor of 3 — so the animation reloads
 * sooner (a shorter cadence) at harder levels. The hand-off is a tail jump:
 * seedEnemyRecords's own return unwinds back to seedChamberCreature's caller, so the delegation IS
 * seedChamberCreature's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state.
 *
 * Named by effect: seeds the first block of round/level parameters (the chamber-creature
 * and Pit floor-reveal parameter block) and derives the reveal-period byte.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f2f.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from the
 *           gameplay round-init tail-jump chain seedDigObjectBlock → seedChamberCreature → seedEnemyRecords, which
 *           attract never reaches), so it is validated on real captured attract
 *           machine states. It reads only the difficulty counter, so any realistic
 *           state is a valid entry: EQUAL over several captured states + a full
 *           counter sweep + a sentinel-preset entry that makes every write
 *           observable, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded parameter bytes and the derived reload byte. The
 *           round-init caller consumes the seeded memory, not any register; the tail
 *           owns everything after the hand-off, identically on both sides.
 * NAMES:    from ram.js — CHAMBER_CREATURE_X/FRAME/ATTR/Y (0x80db–0x80de), CHAMBER_CREATURE_ANIM_PHASE
 *           (0x80e3), PIT_FLOOR_REVEAL_PERIOD (0x80e4), PIT_FLOOR_REVEAL_GATE (0x80e5), PIT_FLOOR_REVEAL_CURSOR (0x80e6),
 *           GOAL_TILE_LATCH (0x80e7), and the LEVEL difficulty counter (0x8028); only
 *           0x80df–0x80e0 in the block stay unnamed hex. The tail is the decompiled
 *           seedEnemyRecords (ROM 0x30de).
 */

import { seedEnemyRecords } from "./seedEnemyRecords.js";

import {
  CHAMBER_CREATURE_ANIM_PHASE,
  CHAMBER_CREATURE_ATTR,
  CHAMBER_CREATURE_FRAME,
  CHAMBER_CREATURE_X,
  CHAMBER_CREATURE_FALL_Y,
  GOAL_TILE_LATCH,
  LEVEL,
  PIT_FLOOR_REVEAL_CURSOR,
  PIT_FLOOR_REVEAL_GATE,
  PIT_FLOOR_REVEAL_PERIOD,
} from "./ram.js";
export function seedChamberCreature(m) {
  const { mem8 } = m;

  // Fixed start values for the parameter/counter block.
  mem8[CHAMBER_CREATURE_X] = 40;
  mem8[CHAMBER_CREATURE_FRAME] = 57;
  mem8[CHAMBER_CREATURE_ATTR] = 192;
  mem8[CHAMBER_CREATURE_FALL_Y] = 120;
  mem8[0x80df] = 1;
  mem8[0x80e0] = 252;
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
