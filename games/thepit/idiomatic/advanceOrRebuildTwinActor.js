// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceOrRebuildTwinActor — per-frame gate for the two-body actor: keep it moving while it is in the
 * high half of the field, otherwise rebuild it at the start edge and redraw.  ROM 0x38c8.
 *
 * A sibling of spawnAltPhaseActor (0x37cf) and spawnTwinActor — the same actor family, the
 * same 2-wide x 4-tall tile figure anchored at the same display cell. Each frame this
 * routine looks at the actor's coordinate and forks:
 *
 *   - Coordinate in the high half (128 or above): the actor is still on-screen, so hand
 *     the frame straight to the cadence/move path (paceActorCadence), whose result carries back
 *     through to our caller.
 *   - Coordinate below the high half: the actor has run off the low edge, so REBUILD it
 *     from scratch. Park the coordinate back at the start edge (240) with the shadow twin
 *     trailing 16 ahead (wrapping to 0), reset both bodies' row to 31 and their tiles
 *     (primary 43, twin 42), stamp the shared paired-display byte (147) and the two
 *     primary-only record fields, arm the cadence timer, then re-stamp the actor's eight-
 *     cell figure (tiles 184..191, one shared colour) into the tilemap and colour map.
 *     Then return.
 *
 * The name stays neutral even though this actor's move-path siblings are now English-named
 * (paceActorCadence / easeActorToRest) and the actor record's offset-0 coordinate is resolved as
 * ENEMY3_X = screen-horizontal. advanceOrRebuildTwinActor keeps its address name because which actor it drives is
 * still not pinned in the mechanism map; the mechanics below are exact.
 *
 * Memory-equivalent to the frozen oracle — equivalence-38c8.test.js.
 * GATE:     captured dispatches + crafted coordinate sweep. Both arms occur naturally in
 *           attract (the very first dispatch rebuilds from the boot state; the rest ride
 *           the move path); the whole coordinate domain 0..255 is then swept identically
 *           on both sides to cover the 127/128 branch boundary; plus teeth.
 * LIVE-OUT: memory-only — the rebuilt actor/twin records, the re-stamped tile+colour
 *           figure, and (on the move arm) everything paceActorCadence leaves. The value registers
 *           the oracle threads are dead ABI (this gate sits on a tail-jump ladder whose
 *           callers reload the register file next frame); the whole-machine gate backstops
 *           that.
 * NAMES:    ENEMY3_X/ENEMY3_Y/ENEMY3_TILE/ENEMY3_TIMER, ENEMY3_TWIN_X/ENEMY3_TWIN_TILE/ENEMY3_TWIN_Y,
 *           ENEMY3_STEP_X/ENEMY3_STEP_Y (the two primary-only record fields 0x810e/0x810f) and
 *           ENEMY3_ATTR/ENEMY3_TWIN_ATTR (the paired-display byte on each record, 0x810c/0x811d)
 *           from ram.js. Kept hex: the video/colour anchors 0x93a3/0x8ba3 (hardware
 *           display addresses).
 *
 * PURPOSE [guess]: which specific game actor the twin figure is (twin RECORD structure IS grounded).
 */

import {
  ENEMY3_STEP_X,
  ENEMY3_STEP_Y,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_X,
  ENEMY3_Y,
  ENEMY3_TWIN_Y,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_X,
  ENEMY3_ATTR,
  ENEMY3_TWIN_ATTR,
} from "./ram.js";
import { paceActorCadence } from "./paceActorCadence.js";

const PAIRED_DISPLAY = 147; // value stamped on both paired-display bytes

// The actor's figure: a 2-wide x 4-tall tile block re-stamped into the tilemap and its
// colour map, anchored at a fixed display cell. The eight cells take consecutive tile
// codes 184..191 in a fixed paint order (the offsets below), all sharing one colour.
const VIDEO_ANCHOR = 0x93a3; // anchor display cell (tilemap RAM)
const COLOUR_ANCHOR = 0x8ba3; // matching cell in colour RAM
const FIRST_TILE = 184;
const FIGURE_COLOUR = 151;
// Cell offsets from the anchor, in paint order; the tile code steps up by one per cell.
const CELL_OFFSETS = [-32, -31, 0, 1, -96, -95, -64, -63];

export function advanceOrRebuildTwinActor(m) {
  const { mem8 } = m;

  // While the actor is still in the high half of the field, keep it moving.
  if (mem8[ENEMY3_X] >= 128) return paceActorCadence(m);

  // The actor ran off the low edge: rebuild the primary body and its shadow twin.
  mem8[ENEMY3_X] = 240; // coordinate parked back at the start edge
  mem8[ENEMY3_TWIN_X] = (240 + 16) % 256; // twin trails 16 ahead, wrapping to 0
  mem8[ENEMY3_Y] = 31; // primary starting row
  mem8[ENEMY3_TWIN_Y] = 31; // twin's matching row
  mem8[ENEMY3_TWIN_TILE] = 42;
  mem8[ENEMY3_TILE] = 43;
  mem8[ENEMY3_STEP_X] = 0; // the two primary-only record fields
  mem8[ENEMY3_STEP_Y] = 1;
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed to fire next tick
  mem8[ENEMY3_ATTR] = PAIRED_DISPLAY;
  mem8[ENEMY3_TWIN_ATTR] = PAIRED_DISPLAY;

  // Re-stamp the actor's eight-cell figure into the display.
  let tile = FIRST_TILE;
  for (const offset of CELL_OFFSETS) {
    mem8[VIDEO_ANCHOR + offset] = tile;
    mem8[COLOUR_ANCHOR + offset] = FIGURE_COLOUR;
    tile += 1;
  }
}
