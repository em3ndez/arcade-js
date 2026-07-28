// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnDigEntity — stage a dig entity at the actor's aligned tilemap cell, and commit it into
 * the map the first pass the spawn slot is free.  ROM 0x28ab.
 *
 * Runs from the per-frame carve/lift handler whenever the tracked actor lines up on a
 * cell. It reads the tile pair at the actor's cell pointer — the cell itself and the
 * tile just before it — and proceeds only when that pair is one the dig system
 * recognises; on any other pair it does nothing beyond stashing the cell pointer.
 *
 * For a recognised pair it classifies which dig entity to place: a sprite id, a
 * sub-type, and how far above the grid-aligned row the entity sits (taller entities sit
 * higher). It then stages the placement into a scratch block — a column a few pixels
 * left of the reaction object's X, a row snapped to the 8-pixel grid below the object
 * and lifted, and a doubled attribute from the reaction period.
 *
 * A one-shot spawn debounce follows: the spawn counter is bumped every pass, but only
 * the pass that finds it idle actually commits the staged entity — the commit tail
 * promotes the staging into the live dig-object record and stamps the entity into the
 * tilemap. Every later pass merely keeps the dig timer armed.
 *
 * Name kept as spawnDigEntity: it is part of the dig-object family whose higher-level game
 * role stays best-effort — its commit tail commitDigEntity and sibling seedDigObjectBlock carry best-effort
 * names for the same reason, and the tile codes it classifies on have no confirmed meaning yet.
 *
 * Memory-equivalent to the frozen oracle — equivalence-28ab.test.js.
 * GATE:     RAM-only — dispatched in a plain boot/attract run (from the carve handler
 *           advanceReactionObject); validated on every real captured dispatch, plus a crafted sweep
 *           over each classification arm crossed with an idle vs busy spawn slot, plus
 *           teeth. pc/SP/registers excluded (the oracle rets internally; this returns).
 * LIVE-OUT: memory-only — the staged scratch block, the bumped spawn counter, the armed
 *           dig timer, and (on commit) the dig-object record + stamped tilemap cells.
 *           The oracle's residual registers/flags are dead ABI; every caller overwrites
 *           the accumulator or jumps away without reading them.
 * NAMES:    ACTOR_CELL_PTR, REACTION_OBJ_X, OBJ_Y, REACTION_STATE, DIG_OBJ_SUBTYPE,
 *           SPAWN_STATE, DIG_OBJ_TIMER from ram.js. The staging scratch (0x80b6/0x80b9/
 *           0x80bc/0x80bf), the saved cell pointer (0x80ba) and the reaction period byte
 *           (0x80a3) have no confirmed name yet and stay hex. The commit is delegated to
 *           the already-decompiled commitDigEntity.
 */

import { commitDigEntity } from "./commitDigEntity.js";
import {
  ACTOR_CELL_PTR,
  REACTION_OBJ_X,
  OBJ_Y,
  REACTION_STATE,
  DIG_OBJ_SUBTYPE,
  SPAWN_STATE,
  DIG_OBJ_TIMER,
} from "./ram.js";

// Scratch cells written here, then read back by the commit tail commitDigEntity.
const STAGED_SPRITE_ID = 0x80bf;
const STAGED_COLUMN = 0x80b6;
const STAGED_ROW = 0x80b9;
const STAGED_ATTR = 0x80bc;
const SAVED_CELL_PTR = 0x80ba;
const REACTION_PERIOD = 0x80a3;

/**
 * Classify the tile pair under the actor's cell into the dig entity to place, or null
 * when the pair is not one the dig system recognises. `neighbourTile` is the tile just
 * before the cell, `currentTile` the cell itself, `tileTwoBack` the tile two before it.
 * Returns { spriteId, subtype, yLift }: the sprite id stamped into the map, the entity
 * sub-type, and how many pixels the placement row is lifted above the grid line.
 * PURE: reads only its three tile inputs.
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
    return null; // neighbour is none of the recognised channel tiles
  }
  // A non-fill cell qualifies only at the channel-cap tile.
  if (currentTile !== 197) return null;
  if (neighbourTile === 193) return { spriteId: 157, subtype: 0, yLift: 13 };
  if (neighbourTile === 42) return { spriteId: 42, subtype: 0, yLift: 13 };
  return { spriteId: 112, subtype: 0, yLift: 13 };
}

export function spawnDigEntity(m) {
  const { mem8, mem16 } = m;

  const cellPtr = mem16[ACTOR_CELL_PTR];
  mem16[SAVED_CELL_PTR] = cellPtr; // the commit tail reloads the cell from here

  const entity = classifyDigEntity(mem8[cellPtr - 1], mem8[cellPtr], mem8[cellPtr - 2]);
  if (entity === null) return; // the actor is not aligned on a diggable tile pair

  // Stage the entity to place.
  mem8[STAGED_SPRITE_ID] = entity.spriteId;
  mem8[DIG_OBJ_SUBTYPE] = entity.subtype;

  // Column a few pixels left of the reaction object's X.
  mem8[STAGED_COLUMN] = mem8[REACTION_OBJ_X] - 4;

  // Row snapped to the 8-pixel grid below the object, then lifted for the entity height.
  let row = mem8[OBJ_Y];
  if (mem8[REACTION_STATE] === 4) row -= 1; // one-pixel bias during the 4th reaction phase
  row = (row + 5) & 0xf8; // round to the nearest 8-pixel grid line
  mem8[STAGED_ROW] = row - entity.yLift;

  // Attribute doubled from the reaction period byte.
  mem8[STAGED_ATTR] = mem8[REACTION_PERIOD] << 1;

  // One-shot spawn debounce: bump the counter every pass, but commit only the pass that
  // finds the slot idle; every later pass just keeps the dig timer armed.
  const spawnState = mem8[SPAWN_STATE];
  mem8[SPAWN_STATE] = spawnState + 1;
  if (spawnState === 0) {
    commitDigEntity(m); // promote the staging into the dig-object record and stamp the cells
    return;
  }
  mem8[DIG_OBJ_TIMER] = 8;
}
