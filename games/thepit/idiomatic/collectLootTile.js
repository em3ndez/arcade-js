// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectLootTile — collect the scoring loot tile the actor has aligned onto: award its
 * points, play the pickup sound, bump that loot kind's count, and blank the tile so it is
 * removed from the playfield (delegates to the dig-arm otherwise).  ROM 0x18cf.
 *
 * Reached from the walk-animation step (resolveObjectTile) once it decides the tile under the
 * actor may be worth collecting. It acts only on the final sub-step before the actor
 * crosses into a new tile column; on any other phase, and for any tile it does not
 * recognise, it hands the frame to the dig-arm classifier (triggerDigReaction) unchanged.
 *
 * On a boundary it recognises two kinds of scoring tile, and for each awards score,
 * bumps that kind's running pickup counter, blanks the cell the actor stands on, and
 * lets the actor keep moving:
 *
 *   - Tile 58: award 10 points and count it.
 *   - Tiles 59..61: only while the feature is enabled. A one-shot latch opens this
 *     award; once open it always awards, but the very first time it opens only when
 *     the guard byte is clear (and it arms the latch), otherwise it defers this frame
 *     to the dig-arm. When it fires, award 20 points and count it.
 *
 * The award itself only moves the score while a player is active (the shared scorer
 * skips an idle slot, as in the attract demo), but the pickup counter, the queued
 * sound, and the blanked cell land every time. Both awards continue into the shared
 * movement tail, whose own return unwinds to this routine's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-18cf.test.js.
 * GATE:     crafted-entry + real dispatches — memory-equivalence over real attract
 *           dispatches (which all take the decline path into triggerDigReaction), plus crafted
 *           entries forcing every branch: the boundary gate, tile 58, tiles 59..61 over
 *           enabled/latch/guard, and the unrecognised-tile declines. The oracle's award
 *           and sound paths park dead scratch just below the entry stack pointer that the
 *           stack-free idiomatic never writes, so the diff excludes that [SP-8, SP) window.
 * LIVE-OUT: memory-only — the two pickup counters, the score and its on-screen digits,
 *           the queued sound, the blanked cell, and whatever the movement tail leaves.
 *           The registers/flags the oracle threads out are dead ABI no caller reads.
 * NAMES:    PLAYER_CELL_PTR, HAZARD_ACTIVE_COUNT from names.js. The two per-kind pickup counters
 *           CRYSTAL_COUNT (0x8081) / DIAMOND_COUNT (0x8082) and the second kind's enable flag
 *           PRIZE_GATE (0x8076) — their roles are clear here but not yet grounded across the game;
 *           its one-shot latch is
 *           TREASURE_COLLECTED (0x8078) and the latch's guard is HAZARD_ACTIVE_COUNT (0x80bd).
 *           Named collectLootTile after the loot tiles it collects, matching its sibling
 *           triggerDigReaction.
 */

import { PLAYER_CELL_PTR, HAZARD_ACTIVE_COUNT, PRIZE_GATE } from "./names.js";
import { triggerDigReaction } from "./triggerDigReaction.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

// Per-kind running pickup counters, and the enable/latch/guard that gate the second
// kind. (0x8081/0x8082/0x8078 are CRYSTAL_COUNT/DIAMOND_COUNT/TREASURE_COLLECTED in
// names.js; aliased locally here.)
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
    // Award 20 points and count it.
    awardTwentyPoints(m);
    mem8[SECOND_TILE_COUNT] = mem8[SECOND_TILE_COUNT] + 1;
  } else {
    // Any other tile on the boundary is not a pickup — hand it to the dig-arm.
    return triggerDigReaction(m, tileCode, positionAccumulator);
  }

  // Collected: blank the cell the actor stands on, then keep the actor moving.
  const cell = mem16[PLAYER_CELL_PTR];
  mem8[cell] = BLANK_TILE;
  return advanceActorWalk(m);
}
