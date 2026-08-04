// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDigTarget — advance the dig target one step and route on the tile it now covers:
 * embed it into the terrain when it reaches solid ground, else just re-stage its sprite.  ROM 0x2d06.
 *
 * The per-tick continuation for the dig target — the loot/prize cell the player is
 * tunnelling toward — reached once that object has either already been captured or has
 * slipped outside the capture window. Each tick it:
 *   - nudges the target one step along its travel axis and stores the new position back;
 *   - works out the on-screen tile cell the target now covers — its cross-axis position
 *     picks the map row (measured from the far edge), the stepped axis picks the column —
 *     and leaves that cell pointer as the live carve cursor;
 *   - reads the tile a fixed step ahead of that cell and routes on it.
 *
 * If the tile ahead is solid ground (one of three wall codes) the target has arrived:
 * the embed continuation (landDigTarget) stamps the wall tile into the neighbouring cell,
 * requests the dig sound, and resets the target's small state block — it takes the cell
 * directly. Otherwise the target simply keeps going and its sprite record is rebuilt at
 * the new position by the record builder stageDigObjectSpriteRecord. Both continuations finish
 * by building the target's four-byte sprite record, whose own return unwinds to this
 * routine's caller — so each delegation is the exit, not a call.
 *
 * The name claims only what is unambiguous here: it advances the dig target (a coordinate
 * this routine mutates) and re-stages it. The tile codes' exact terrain meaning and the
 * on-screen axis (X vs Y under the rotated display) stay open, so the name does not reach
 * past the advance itself.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d06.test.js.
 * GATE:     crafted-entry — the attract demo never digs, so 0x2d06 is never dispatched;
 *           validated on real captured attract states with the target coordinates and the
 *           probed tile crafted identically on both sides. Sweeps the whole tile domain to
 *           pin the embed-vs-continue boundary exactly, and the target's position across
 *           both axes to pin the row/column/advance arithmetic. The embed route runs the
 *           idiomatic landDigTarget, the continue route stageDigObjectSpriteRecord, so a wrong
 *           advance, cell, or route diverges the resulting RAM. Teeth: wrong advance,
 *           wrong cursor, wrong route, wrong embed cell.
 * LIVE-OUT: memory-only — the advanced target position and the stored cell pointer. The
 *           cell it computes is passed to the embed continuation as an argument, so no
 *           register crosses that boundary; the residual working registers/flags are dead.
 * NAMES:    HAZARD_X, HAZARD_Y from names.js. The live carve cursor is CARVE_CELL_PTR (0x80af).
 */

import { HAZARD_X, HAZARD_Y, CARVE_CELL_PTR } from "./names.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { u8 } from "../../../core/int.js";
import { landDigTarget } from "./landDigTarget.js";

// Base of the on-screen tile map in video RAM; a cell is an offset from here.
const VRAM_BASE = 0x9000;

export function advanceDigTarget(m) {
  const { mem8, mem16 } = m;

  // Cross-axis position -> map row, measured from the far edge (32 rows, 0..31).
  const row = 31 - (mem8[HAZARD_X] >> 3);

  // Advance the target one step along its travel axis and store the new position back.
  const advancedY = mem8[HAZARD_Y] + 1;
  mem8[HAZARD_Y] = advancedY;

  // The cell the target now covers; the probe reads one step further along the axis.
  const col = u8(advancedY + 1) >> 3;
  const cell = VRAM_BASE + row * 32 + col;
  mem16[CARVE_CELL_PTR] = cell; // leave it as the live carve cursor

  // The tile a fixed step ahead of the target's cell.
  const aheadTile = mem8[cell - 30];

  // Solid-ground codes -> the target embeds at that cell; anything else -> keep going and
  // rebuild the sprite record (stageDigObjectSpriteRecord).
  if (aheadTile === 42 || aheadTile === 43 || aheadTile === 65) return landDigTarget(m, cell);
  return stageDigObjectSpriteRecord(m);
}
