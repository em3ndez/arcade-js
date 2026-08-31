// SPDX-License-Identifier: GPL-3.0-only
import {
  ACTIVE_LANE_COUNT,
  ROUND_COUNTER,
  ANIM_FRAME_COUNTER,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  TARGET_TILE_ROW_TABLE,
  ANIM_TABLE_3838,
  ANIM_TABLE_3856,
} from "./names.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { enterPreSpawnGateIfBelowLimit } from "./enterPreSpawnGateIfBelowLimit.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * resolveTargetColumnAndArmApproach — decide whether an enemy actor has reached its
 * target tile-column this frame and, once it has crawled far enough, arm its approach.
 *
 * ROM 0x357C-0x35C5. Grounding: [seen].
 *
 * WHAT IT IS
 *   A per-frame state step run over one enemy actor record, addressed by IX. Enemies in
 *   this wave crawl across the playfield one tile-column at a time; each frame this
 *   routine works out the column the actor is *supposed* to be heading for, compares it
 *   against the actor's current coarse column (rec+0x06), and takes one of three
 *   actions: begin the spawn/approach on an exact column hit; wait (touch nothing) while
 *   the actor is still short of the turn threshold; or latch the actor and point it at an
 *   approach animation script once it has crossed that threshold.
 *
 * HOW THE TARGET COLUMN IS CHOSEN
 *   - No lane active (ACTIVE_LANE_COUNT 0x8D79 == 0): the wanted column comes from a
 *     per-frame scanning table. ROUND_COUNTER (0x8907) picks the table row (its low
 *     nibble, halved) and ANIM_FRAME_COUNTER (0x8D41) picks the column within that row
 *     (its low 3 bits), so the target sweeps as the animation frame counter advances.
 *   - A lane active (ACTIVE_LANE_COUNT != 0): the actor revives an alternate lane. The
 *     record's flag byte rec+0x07 bit2 chooses between a direct re-entry — which fetches
 *     no target at all and steps on the actor's own current column — and a second target
 *     table (ALT_TARGET_TABLE_PTR 0x8D6F) indexed by the per-slot spawn tally
 *     (SLOT_SPAWN_INDEX 0x8D7B).
 *
 * LIVE-OUT: no value is read back afterwards; the results live in the actor record.
 *   On an exact column hit, control continues into the pre-spawn guard. On the arm path
 *   the state latch rec+0x08 is set to 1 and the record is repointed at one of two
 *   approach animation scripts (rec+0x07 bit1 selects ANIM_TABLE_3856 over
 *   ANIM_TABLE_3838). While the actor is still below the turn threshold the record is
 *   left untouched.
 */
const BIT2 = 0x04; // rec+0x07 bit2: clear -> re-enter directly and step on the actor's own column, skipping the target lookup
const BIT1 = 0x02; // rec+0x07 bit1: selects the second approach script (ANIM_TABLE_3856) over the first (ANIM_TABLE_3838)
const TILE_THRESHOLD = 0x14; // a current column below this is too early to turn -> the actor waits this frame

export function resolveTargetColumnAndArmApproach(m, ix = m.regs.ix) {
  const { mem8, mem16 } = m;

  // The wanted target this frame is a (base row, column) pair to be resolved below.
  // `doLookup` stays true unless the lane-active direct re-entry elects to skip the
  // table lookup and step straight on the actor's own current column.
  let base;
  let column;
  let doLookup = true;

  // --- Pick where the wanted target column comes from ---
  if (mem8[ACTIVE_LANE_COUNT] !== 0) {
    // A lane is active (ACTIVE_LANE_COUNT 0x8D79): this actor revives an alternate lane.
    if ((mem8[ix + 0x07] & BIT2) === 0) {
      // rec+0x07 bit2 clear: fetch no target; the actor's own current column (rec+0x06)
      // feeds the threshold/arm step below.
      doLookup = false; // direct-compare re-entry: skip the table lookup
    } else {
      // rec+0x07 bit2 set: aim at the alternate target table (ALT_TARGET_TABLE_PTR
      // 0x8D6F), indexed by the per-slot spawn tally (SLOT_SPAWN_INDEX 0x8D7B).
      base = mem16[ALT_TARGET_TABLE_PTR];
      column = mem8[SLOT_SPAWN_INDEX];
    }
  } else {
    // No lane active: read the wanted column from the per-frame scanning table. The row
    // is chosen by ROUND_COUNTER (0x8907) — low nibble, halved — and the column by
    // ANIM_FRAME_COUNTER (0x8D41) low 3 bits, so the target oscillates frame to frame.
    const rowIndex = (mem8[ROUND_COUNTER] & 0x0f) >> 1;
    base = fetchWordFromTableIndex(m, rowIndex, TARGET_TILE_ROW_TABLE); // row base word from TARGET_TILE_ROW_TABLE (0x35C7)
    column = mem8[ANIM_FRAME_COUNTER] & 0x07;
  }

  // --- Resolve the wanted tile and test for an exact column hit ---
  if (doLookup) {
    // Index `column` into the chosen row at `base` to get the wanted tile-column.
    const [wanted] = fetchByteFromTableIndex(m, base, column);
    // Actor's coarse column (rec+0x06) already on target -> hand off to the pre-spawn
    // guard, which admits the spawn only while below its active-object limit.
    if (mem8[ix + 0x06] === wanted) return enterPreSpawnGateIfBelowLimit(m, undefined, ix); // exact hit
  }

  // --- Not an exact hit: either wait, or arm the approach ---
  // Too early: the actor has not crawled far enough to turn -> leave the record alone.
  if (mem8[ix + 0x06] < TILE_THRESHOLD) return; // below threshold
  // Far enough: latch the actor into its approach so this arming fires only once.
  mem8[ix + 0x08] = 0x01; // latch the state
  // Choose the approach animation: rec+0x07 bit1 picks the second (turn-variant) script.
  const script = mem8[ix + 0x07] & BIT1 ? ANIM_TABLE_3856 : ANIM_TABLE_3838;
  // Seat the chosen script into the record and restart its animation.
  return setActorAnimation(m, ix, script);
}
