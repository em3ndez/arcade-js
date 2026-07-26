// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_18cf — the tile-boundary "collect a scoring tile" arm of the actor-movement dispatch.  ROM 0x18cf.
 *
 * Reached from the walk-animation step (loc_186f) once it decides the tile under the
 * actor may be worth collecting. It acts only on the final sub-step before the actor
 * crosses into a new tile column; on any other phase, and for any tile it does not
 * recognise, it hands the frame to the dig-arm classifier (loc_191f) unchanged.
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
 *           dispatches (which all take the decline path into loc_191f), plus crafted
 *           entries forcing every branch: the boundary gate, tile 58, tiles 59..61 over
 *           enabled/latch/guard, and the unrecognised-tile declines. The oracle's award
 *           and sound paths park dead scratch just below the entry stack pointer that the
 *           stack-free idiomatic never writes, so the diff excludes that [SP-8, SP) window.
 * LIVE-OUT: memory-only — the two pickup counters, the score and its on-screen digits,
 *           the queued sound, the blanked cell, and whatever the movement tail leaves.
 *           The registers/flags the oracle threads out are dead ABI no caller reads.
 * NAMES:    ACTOR_CELL_PTR from ram.js. The two per-kind pickup counters 0x8081/0x8082,
 *           the second kind's enable flag 0x8076, its one-shot latch 0x8078, and the
 *           latch's guard 0x80bd stay hex — their roles are clear here but not yet
 *           grounded across the game. Kept the neutral loc_18cf name for the same reason
 *           (candidate: collectScoringTile), matching its sibling loc_191f.
 */

import { ACTOR_CELL_PTR, SPAWN_STATE, FEATURE_TILE_LATCH } from "./ram.js";
import { loc_191f } from "./loc_191f.js";
import { awardTenPoints } from "./awardTenPoints.js";

// Per-kind running pickup counters, and the enable/latch/guard that gate the second
// kind. The roles are legible here but not yet grounded across routines, so the
// addresses stay in hex.
const FIRST_TILE_COUNT = 0x8081; // times a tile-58 pickup was collected
const SECOND_TILE_COUNT = 0x8082; // times a tile-59..61 pickup was collected
const SECOND_TILE_LATCH = 0x8078; // one-shot latch that opens the second pickup

const BLANK_TILE = 112; // the empty-cell tile stamped over a collected pickup

export function loc_18cf(m, tileCode = m.regs.b, positionAccumulator = m.regs.e) {
  const { mem } = m;

  // Collect only on the final sub-step before the actor crosses into a new tile
  // column; on every other phase the tile goes to the dig-arm classifier.
  if ((positionAccumulator + 1) % 8 !== 0) {
    return loc_191f(m, tileCode, positionAccumulator);
  }

  if (tileCode === 58) {
    // First pickup kind: 10 points, count it.
    awardTenPoints(m);
    mem.write8(FIRST_TILE_COUNT, mem.read8(FIRST_TILE_COUNT) + 1);
  } else if (tileCode >= 59 && tileCode <= 61) {
    // Second pickup kind, and only while its feature is enabled.
    if (mem.read8(FEATURE_TILE_LATCH) === 0) {
      return loc_191f(m, tileCode, positionAccumulator);
    }
    // A one-shot latch opens the award. Once open it always awards; the very first
    // time, it opens only when the guard is clear (and arms the latch itself),
    // otherwise it defers this frame to the dig-arm.
    if (mem.read8(SECOND_TILE_LATCH) === 0) {
      if (mem.read8(SPAWN_STATE) !== 0) {
        return loc_191f(m, tileCode, positionAccumulator);
      }
      mem.write8(SECOND_TILE_LATCH, 1);
    }
    // Award 20 points (still the frozen oracle's scorer) and count it.
    m.call(0x4683);
    mem.write8(SECOND_TILE_COUNT, mem.read8(SECOND_TILE_COUNT) + 1);
  } else {
    // Any other tile on the boundary is not a pickup — hand it to the dig-arm.
    return loc_191f(m, tileCode, positionAccumulator);
  }

  // Collected: blank the cell the actor stands on, then keep the actor moving.
  const cell = mem.read16(ACTOR_CELL_PTR);
  mem.write8(cell, BLANK_TILE);
  return m.call(0x19d0);
}
