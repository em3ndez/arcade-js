// SPDX-License-Identifier: GPL-3.0-only
/**
 * locateActorCellCheckGoal — route a moving actor's horizontal step: if it has reached the goal
 * terminator tile, latch the goal crossing and walk it on; otherwise resolve the
 * terrain step it is entering.  ROM 0x16b9.
 *
 * Reached from the per-frame object dispatch (stepObjectRowUnflipped) once that has turned the
 * actor's position into a tile row. It is handed that row and the actor's sprite/
 * state code, locates the tilemap cell the actor stands on, and decides between two
 * outcomes:
 *
 *   - GOAL REACHED. Either the actor's sprite already says it is standing on the
 *     terminator (checked only once the goal latch is set), or the goal terminator
 *     tile sits in the cell one step ahead / that same cell one full row further
 *     down. In that case it latches the goal crossing (two flags a later state
 *     dispatch reads to reroute to the goal handler) and hands off to the walk
 *     advance, which carries the actor toward the crossing.
 *   - OTHERWISE. It hands the step to the terrain-collision handler, giving it the
 *     cell pointer and the biased column (whose low bits tell that handler whether
 *     the actor is aligned on a tile boundary this frame).
 *
 * The cell is located from the actor's column position — biased by a rounding
 * constant, its top bits give the tile column and its low bits the sub-tile phase —
 * combined with the tile row into a tilemap address. The column and cell pointer are
 * published to work RAM so the terrain handler can reuse them.
 *
 * Both handoffs tail into the object's record builder, whose result is entirely in
 * RAM, so this routine leaves no register for its caller to read.
 *
 * Kept as locateActorCellCheckGoal: its sibling terrain handler resolveActorTerrainStep is itself still neutrally
 * named, and the goal-crossing/terminator mechanic (what "reaching" the tile means,
 * the sprite/state code it watches for) is only partly pinned — a single effect-verb
 * would over-claim, so the neutral name stays.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16b9.test.js.
 * GATE:     RAM-only over real captured attract dispatches (0x16b9 runs 77x in a plain
 *           attract run, all via the terrain-step handoff) + crafted goal-reached
 *           entries (the goal tile poked one step ahead and one row further down, and
 *           the already-at-terminator short-circuit) for the latch+advance arm attract
 *           never produces. Excludes the dead stack scratch the still-oracle terrain
 *           handler parks below the entry stack pointer (the idiomatic handoffs are
 *           stack-free). Teeth: a corrupted cell pointer, a dropped goal latch.
 * LIVE-OUT: memory-only — the staged tile column (PLAYER_TILE_COL) and cell pointer
 *           (PLAYER_CELL_PTR), the goal/crossing latches on a goal hit, plus everything
 *           the terrain handler or the walk advance writes downstream. No register
 *           live-out (both handoffs tail into the record builder, whose whole result
 *           is RAM).
 * NAMES:    PLAYER_X, PLAYER_TILE_COL, PLAYER_CELL_PTR, GOAL_TILE_LATCH, PIT_CROSS_ACTIVE
 *           from names.js. The goal terminator tile (39) and the already-at-terminator
 *           sprite/state code (0x17, kept hex like the sibling sprite-code family) are
 *           literals; so are the tilemap base/row-stride and the column rounding bias.
 *
 * PURPOSE [guess]: "Actor"=downstream vocab; same shared-entity caveat.
 */

import { PLAYER_X, PLAYER_TILE_COL, PLAYER_CELL_PTR, GOAL_TILE_LATCH, PIT_CROSS_ACTIVE } from "./names.js";
import { u8 } from "../../../core/int.js";
import { resolveActorTerrainStep } from "./resolveActorTerrainStep.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

const GOAL_TILE = 39; // tile 0x27 — the terminator/goal cell the actor is watching for
const AT_TERMINATOR_SPRITE = 0x17; // sprite/state code meaning "already standing on the terminator"
const TILEMAP_BASE = 0x9000; // base address of the tilemap the cell pointer indexes into
const ROW_STRIDE = 32; // tilemap cells per row
const COLUMN_BIAS = 5; // rounding bias folded into the column before reducing it to a tile column

/** Latch the goal crossing (both flags the state dispatch reads) and walk the actor on. */
function latchGoalAndAdvance(m, latchValue) {
  const { mem8 } = m;
  mem8[GOAL_TILE_LATCH] = latchValue;
  mem8[PIT_CROSS_ACTIVE] = latchValue;
  return advanceActorWalk(m);
}

export function locateActorCellCheckGoal(m, row = m.regs.h, spriteCode = m.regs.l) {
  const { mem8, mem16 } = m;

  // Once the goal latch is set, an actor whose sprite says it is already on the terminator
  // skips the tilemap peek and goes straight to latching the crossing + walking on.
  if (mem8[GOAL_TILE_LATCH] !== 0 && spriteCode === AT_TERMINATOR_SPRITE) {
    return latchGoalAndAdvance(m, spriteCode);
  }

  // Locate the tilemap cell under the actor. The biased column's top bits are the tile
  // column; its low bits are the sub-tile phase the terrain handler reads. Row and column
  // fold into the cell address; both column and pointer are published for that handler.
  const biasedColumn = u8(mem8[PLAYER_X] + COLUMN_BIAS);
  const tileColumn = biasedColumn >> 3;
  mem8[PLAYER_TILE_COL] = tileColumn;
  const cellPtr = TILEMAP_BASE + row * ROW_STRIDE + tileColumn;
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Reaching the goal terminator in the cell one step ahead, or that cell one full row
  // further down, latches the crossing and walks the actor toward it.
  const cellAhead = cellPtr + 1;
  const cellAheadNextRow = cellPtr + 1 + ROW_STRIDE;
  if (mem8[cellAhead] === GOAL_TILE || mem8[cellAheadNextRow] === GOAL_TILE) {
    return latchGoalAndAdvance(m, GOAL_TILE);
  }

  // Not at the goal — resolve the horizontal step against the terrain the actor is entering.
  return resolveActorTerrainStep(m, cellPtr, biasedColumn);
}
