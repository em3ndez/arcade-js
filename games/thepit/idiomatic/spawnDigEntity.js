// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnDigEntity — stage a dig entity at the actor's aligned tilemap cell, and commit it into the
 * map the first pass the spawn slot is free.
 *
 * Runs from the per-frame carve/lift handler whenever the tracked actor lines up on a cell. It
 * reads the tile pair at the actor's cell pointer PLAYER_CELL_PTR and proceeds only when that pair
 * is one the dig system recognises; on any other pair it does nothing beyond stashing the pointer.
 * For a recognised pair it classifies which dig entity to place (a sprite id, a sub-type, and how
 * far above the grid-aligned row it sits), then stages the placement into a scratch block: a column
 * a few pixels left of the reaction object's X, a row snapped to the 8-pixel grid below the object
 * and lifted, and a doubled attribute from REACTION_PERIOD. A one-shot debounce follows: the spawn
 * counter HAZARD_ACTIVE_COUNT is bumped every pass, but only the pass that finds it idle actually
 * commits the staged entity — commitDigEntity promotes the staging into the live dig-object record
 * and stamps the entity into the tilemap. Every later pass merely keeps DIG_OBJ_TIMER armed. The
 * name is best-effort: the higher-level role and the tile codes it classifies on stay unpinned.
 */

import { commitDigEntity } from "./commitDigEntity.js";
import {
  PLAYER_CELL_PTR,
  REACTION_OBJ_X,
  PLAYER_X,
  REACTION_STATE,
  DIG_OBJ_SUBTYPE,
  HAZARD_ACTIVE_COUNT,
  DIG_OBJ_TIMER,
  REACTION_PERIOD,
} from "./names.js";

// Scratch cells written here, then read back by the commit tail commitDigEntity.
const STAGED_SPRITE_ID = 0x80bf;
const STAGED_COLUMN = 0x80b6;
const STAGED_ROW = 0x80b9;
const STAGED_ATTR = 0x80bc;
const SAVED_CELL_PTR = 0x80ba;

/**
 * Classify the tile pair under the actor's cell into the dig entity to place, or null when the
 * pair is not recognised. Pure: reads only `neighbourTile` (just before the cell), `currentTile`
 * (the cell), and `tileTwoBack`. Returns { spriteId, subtype, yLift }: the sprite id stamped into
 * the map, the entity sub-type, and how many pixels the placement row is lifted above the grid line.
 */
function classifyDigEntity(neighbourTile, currentTile, tileTwoBack) {
  if (currentTile === 112) {
    // The cell already holds the fill tile: the tile just before it selects the entity.
    if (neighbourTile === 193 || neighbourTile === 149) {
      // Sub-type 2 only when the tile two cells back also opens the channel.
      return { spriteId: 112, subtype: tileTwoBack === 193 ? 2 : 0, yLift: 17 };
    }
    if (neighbourTile === 197) {
      return { spriteId: 112, subtype: 1, yLift: 21 };
    }
    return null;
  }
  // A non-fill cell qualifies only at the channel-cap tile.
  if (currentTile !== 197) return null;
  if (neighbourTile === 193) return { spriteId: 157, subtype: 0, yLift: 13 };
  if (neighbourTile === 42) return { spriteId: 42, subtype: 0, yLift: 13 };
  return { spriteId: 112, subtype: 0, yLift: 13 };
}

export function spawnDigEntity(m) {
  const { mem8, mem16 } = m;

  const cellPtr = mem16[PLAYER_CELL_PTR];
  mem16[SAVED_CELL_PTR] = cellPtr;

  const entity = classifyDigEntity(mem8[cellPtr - 1], mem8[cellPtr], mem8[cellPtr - 2]);
  if (entity === null) return; // the actor is not aligned on a diggable tile pair

  // Stage the entity: sprite id and sub-type, then column a few pixels left of the object's X.
  mem8[STAGED_SPRITE_ID] = entity.spriteId;
  mem8[DIG_OBJ_SUBTYPE] = entity.subtype;
  mem8[STAGED_COLUMN] = mem8[REACTION_OBJ_X] - 4;

  // Row snapped to the 8-pixel grid below the object, then lifted for the entity height.
  let row = mem8[PLAYER_X];
  if (mem8[REACTION_STATE] === 4) row -= 1; // one-pixel bias during the 4th reaction phase
  row = (row + 5) & 0xf8; // round to the nearest 8-pixel grid line
  mem8[STAGED_ROW] = row - entity.yLift;
  mem8[STAGED_ATTR] = mem8[REACTION_PERIOD] << 1; // attribute doubled from the reaction period

  // One-shot debounce: bump the counter every pass, but commit only the pass that finds it idle.
  const spawnState = mem8[HAZARD_ACTIVE_COUNT];
  mem8[HAZARD_ACTIVE_COUNT] = spawnState + 1;
  if (spawnState === 0) {
    commitDigEntity(m); // promote the staging into the dig-object record and stamp the cells
    return;
  }
  mem8[DIG_OBJ_TIMER] = 8;
}
