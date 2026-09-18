// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectLootTile — collect the scoring loot tile the actor has aligned onto: award its points, play
 * the pickup sound, bump that loot kind's count, and blank the tile so it leaves the playfield
 * (delegates to the dig-arm otherwise).
 *
 * Reached from the walk-animation step once it decides the tile under the actor may be worth
 * collecting. It acts only on the final sub-step before the actor crosses into a new tile column; any
 * other phase, or any unrecognised tile, is handed to the dig-arm classifier. On a boundary it
 * recognises two scoring tiles: tile 58 awards 10 points, and tiles 59..61 award 20 while the feature
 * is enabled (a one-shot latch opens that award, and the first arming needs the guard byte clear,
 * else it defers to the dig-arm). Each award scores only while a player is active, but counts the
 * pickup, queues the sound, blanks the cell, and continues into the shared movement tail.
 */

import { PLAYER_CELL_PTR, HAZARD_ACTIVE_COUNT, PRIZE_GATE } from "./names.js";
import { triggerDigReaction } from "./triggerDigReaction.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

// Per-kind running pickup counters and the one-shot latch that gates the second kind.
const FIRST_TILE_COUNT = 0x8081; // times a tile-58 pickup was collected
const SECOND_TILE_COUNT = 0x8082; // times a tile-59..61 pickup was collected
const SECOND_TILE_LATCH = 0x8078; // one-shot latch that opens the second pickup

const BLANK_TILE = 112; // the empty-cell tile stamped over a collected pickup

export function collectLootTile(m, tileCode = m.regs.b, positionAccumulator = m.regs.e) {
  const { mem8, mem16 } = m;

  // Collect only on the final sub-step before the actor crosses into a new tile
  // column; on every other phase the tile goes to the dig-arm classifier.
  if ((positionAccumulator + 1) % 8 !== 0) {
    return triggerDigReaction(m, tileCode, positionAccumulator);
  }

  if (tileCode === 58) {
    // First pickup kind: 10 points, count it.
    awardTenPoints(m);
    mem8[FIRST_TILE_COUNT] = mem8[FIRST_TILE_COUNT] + 1;
  } else if (tileCode >= 59 && tileCode <= 61) {
    // Second pickup kind, and only while its feature is enabled.
    if (mem8[PRIZE_GATE] === 0) {
      return triggerDigReaction(m, tileCode, positionAccumulator);
    }
    // A one-shot latch opens the award. Once open it always awards; the very first
    // time, it opens only when the guard is clear (and arms the latch itself),
    // otherwise it defers this frame to the dig-arm.
    if (mem8[SECOND_TILE_LATCH] === 0) {
      if (mem8[HAZARD_ACTIVE_COUNT] !== 0) {
        return triggerDigReaction(m, tileCode, positionAccumulator);
      }
      mem8[SECOND_TILE_LATCH] = 1;
    }
    awardTwentyPoints(m);
    mem8[SECOND_TILE_COUNT] = mem8[SECOND_TILE_COUNT] + 1;
  } else {
    return triggerDigReaction(m, tileCode, positionAccumulator);
  }

  // Collected: blank the cell the actor stands on, then keep the actor moving.
  const cell = mem16[PLAYER_CELL_PTR];
  mem8[cell] = BLANK_TILE;
  return advanceActorWalk(m);
}
