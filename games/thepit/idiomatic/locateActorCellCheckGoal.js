// SPDX-License-Identifier: GPL-3.0-only
/**
 * locateActorCellCheckGoal — route a moving actor's horizontal step: if it has reached the goal terminator tile, latch the goal crossing and walk it on; otherwise resolve the terrain step it is entering.
 *
 * Reached from the per-frame object dispatch once that has turned the actor's position into
 * a tile row. Handed that row and the actor's sprite/state code, it locates the tilemap cell
 * the actor stands on and decides between two outcomes. GOAL REACHED — either the sprite
 * already says it is on the terminator (checked once the goal latch is set), or the goal
 * terminator tile sits one cell ahead or one full row further down; then it latches the
 * crossing (two flags a later state dispatch reads) and hands off to the walk advance.
 * OTHERWISE — it hands the step to the terrain-collision handler with the cell pointer and
 * the biased column (whose low bits say whether the actor is on a tile boundary this frame).
 * Both handoffs tail into the record builder, so no register is left live; the terminator
 * mechanic is only partly pinned, so the name stays neutral.
 */

import { PLAYER_X, PLAYER_TILE_COL, PLAYER_CELL_PTR, GOAL_TILE_LATCH, PIT_CROSS_ACTIVE, VIDEO_RAM_BASE } from "./names.js";
import { u8 } from "../../../core/int.js";
import { resolveActorTerrainStep } from "./resolveActorTerrainStep.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

const GOAL_TILE = 39; // the terminator/goal cell the actor is watching for
const AT_TERMINATOR_SPRITE = 0x17; // sprite/state code meaning "already on the terminator"
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

  // Goal latch set and sprite says already-on-terminator: latch the crossing and walk on.
  if (mem8[GOAL_TILE_LATCH] !== 0 && spriteCode === AT_TERMINATOR_SPRITE) {
    return latchGoalAndAdvance(m, spriteCode);
  }

  // Locate the cell: biased column (top bits tile column, low bits sub-tile phase) folded with the row; both published.
  const biasedColumn = u8(mem8[PLAYER_X] + COLUMN_BIAS);
  const tileColumn = biasedColumn >> 3;
  mem8[PLAYER_TILE_COL] = tileColumn;
  const cellPtr = VIDEO_RAM_BASE + row * ROW_STRIDE + tileColumn;
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Goal terminator one cell ahead or one row down: latch the crossing and walk on.
  const cellAhead = cellPtr + 1;
  const cellAheadNextRow = cellPtr + 1 + ROW_STRIDE;
  if (mem8[cellAhead] === GOAL_TILE || mem8[cellAheadNextRow] === GOAL_TILE) {
    return latchGoalAndAdvance(m, GOAL_TILE);
  }

  // Not at the goal — resolve the horizontal step against the terrain the actor is entering.
  return resolveActorTerrainStep(m, cellPtr, biasedColumn);
}
