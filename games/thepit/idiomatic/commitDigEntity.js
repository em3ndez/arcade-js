// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitDigEntity — commit one dig entity into its tilemap cell and patch the neighbours.  ROM 0x2934.
 *
 * The tail reached once the dig-object spawn counter has rolled down to a fresh
 * commit (from the placement classifier's `jr z` and from the per-frame carve
 * handler's tail-jump while more entities are pending). Everything it needs was
 * staged earlier into a scratch block; this routine promotes that staging into the
 * live dig-object record and stamps the entity into the tilemap:
 *
 *   - Arms the record: the carving-phase state code, its attribute byte, and reloads
 *     the entity's saved tilemap cell pointer as the live carve cursor.
 *   - Commits the staged placement values — the target column (also mirrored), the
 *     target row, and the initial dig timer — into the record the carve handler reads.
 *   - Stamps the entity into the tilemap: its sprite id in the cell just before the
 *     cursor, and the fill tile in the cursor's own cell.
 *   - Patches the tile that used to sit before the cursor so the dug channel joins up:
 *     three "seam" neighbour codes defer to the entity's sub-type (which may instead
 *     patch two cells back), tiles in the dig-channel band are remapped through a ROM
 *     translation table, and anything else is left as the just-written sprite id.
 *
 * Named by effect: commits one staged dig entity into the live dig-object record and
 * stamps it into the tilemap.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2934.test.js.
 * GATE:     crafted-entry — never dispatched in a boot/attract run (the demo never
 *           digs deep enough to commit an entity), so it is validated on real captured
 *           attract states with the staging block, cell pointer and neighbour tiles
 *           crafted identically on both sides, plus a sweep of every neighbour class
 *           and every sub-type arm.
 * LIVE-OUT: memory-only — the seeded dig-object record and the stamped/patched tilemap
 *           cells. It reads all its inputs from RAM and returns nothing; the oracle's
 *           residual registers/flags are dead ABI.
 * NAMES:    DIG_OBJ_STATE, DIG_OBJ_ATTR, DIG_OBJ_TIMER, DIG_OBJ_SUBTYPE, TARGET_X,
 *           TARGET_Y from ram.js. The staging scratch (0x80b6/0x80b9/0x80bc/0x80bf),
 *           the saved + live carve cell pointers (0x80ba/0x80af) and the target-column
 *           mirror (0x80be) have no confirmed name yet and stay hex.
 */

import { u8 } from "../../../core/int.js";
import {
  DIG_OBJ_ATTR,
  DIG_OBJ_STATE,
  DIG_OBJ_SUBTYPE,
  DIG_OBJ_TIMER,
  STAGED_CELL_PTR,
  STAGED_DIG_SPRITE_ID,
  STAGED_DIG_TIMER,
  STAGED_TARGET_X,
  STAGED_TARGET_Y,
  TARGET_X,
  TARGET_Y,
} from "./ram.js";

const CARVING_STATE = 48; // dig-object state code for the carving phase
const FILL_TILE = 112; // marker tile stamped into a committed cell
const TILE_REMAP_TABLE = 0x2dc3; // ROM: dig-channel tile code -> patched seam tile

export function commitDigEntity(m) {
  const { mem8, mem16 } = m;

  // Arm the dig object's record and reload its saved tilemap cell as the carve cursor.
  mem8[DIG_OBJ_STATE] = CARVING_STATE;
  mem8[DIG_OBJ_ATTR] = 7;
  const cellPtr = mem16[STAGED_CELL_PTR];
  mem16[0x80af] = cellPtr;

  // Promote the values staged earlier into the live record the carve handler reads.
  const stagedColumn = mem8[STAGED_TARGET_X];
  mem8[TARGET_X] = stagedColumn;
  mem8[0x80be] = stagedColumn; // mirror of the target column
  mem8[TARGET_Y] = mem8[STAGED_TARGET_Y];
  mem8[DIG_OBJ_TIMER] = mem8[STAGED_DIG_TIMER];

  // Capture the tile currently before the cursor, then stamp the entity in: its sprite
  // id where that neighbour was, and the fill tile in the cursor's own cell.
  const oldNeighbour = mem8[cellPtr - 1];
  mem8[cellPtr - 1] = mem8[STAGED_DIG_SPRITE_ID];
  mem8[cellPtr] = FILL_TILE;

  // Patch the captured neighbour so the dug channel joins up cleanly.
  if (oldNeighbour === 193 || oldNeighbour === 149 || oldNeighbour === 197) {
    // Seam neighbours defer to the entity's sub-type, which patches two cells back.
    patchSeamBySubtype(m, cellPtr);
    return;
  }
  if (oldNeighbour >= 150 && oldNeighbour <= 153) {
    // A dig-channel tile: remap it through the translation table.
    mem8[cellPtr - 1] = mem8[TILE_REMAP_TABLE + (oldNeighbour - 150)];
  }
  // Anything else keeps the just-written sprite id.
}

// Sub-type dispatch for the seam neighbours: sub-type 0 leaves the two-cells-back tile
// alone; sub-type 2 re-arms the dig timer and lays the fill tile two cells back; any
// other sub-type remaps that tile through the same dig-channel translation table.
function patchSeamBySubtype(m, cellPtr) {
  const { mem8 } = m;
  const subtype = mem8[DIG_OBJ_SUBTYPE];
  if (subtype === 0) return;
  if (subtype === 2) {
    mem8[DIG_OBJ_TIMER] = 16;
    mem8[cellPtr - 2] = FILL_TILE;
    return;
  }
  mem8[cellPtr - 2] = mem8[TILE_REMAP_TABLE + u8(mem8[cellPtr - 2] - 150)];
}
