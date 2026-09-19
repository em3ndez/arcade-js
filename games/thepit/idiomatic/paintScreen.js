// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintScreen — lay down a whole screen: a selectable tile layer and its colour layer, the two
 * fixed playfield edge columns and the score HUD, then arm the screen's cell-animation counter.
 *
 * Puts a complete screen up in one shot. The playfield is a 32x32 grid of tile cells each with a
 * matching colour cell. It waits a frame for prior display work to settle, copies a 1024-cell tile
 * image into the tilemap (two images are baked in and the low bit of the display-mode byte, LEVEL,
 * picks which — so the same routine paints either variant), waits another frame and copies the
 * fixed 1024-cell colour image into the colour map, stamps the two fixed edge columns and repaints
 * the score HUD, then arms the cell-animation counter (GLITTER_COUNTDOWN) to 1 to start the
 * per-frame recolour cycle. Which screen the two tile images represent is not yet pinned.
 */
import { waitFrames } from "./waitFrames.js";
import { drawLeftEdgeColumn } from "./drawLeftEdgeColumn.js";
import { redrawScoreHud } from "./redrawScoreHud.js";
import { drawRightEdgeColumn } from "./drawRightEdgeColumn.js";

import {
  GLITTER_COUNTDOWN,
  LEVEL,
  PLAYFIELD_COLOUR_IMAGE,
  PLAYFIELD_TILE_IMAGE_LEVEL_EVEN,
  PLAYFIELD_TILE_IMAGE_LEVEL_ODD,
} from "./names.js";
const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the matching per-cell colour map
const SCREEN_CELLS = 1024;

export function* paintScreen(m) {
  const { mem8 } = m;

  // Let a frame pass so prior display setup takes, then copy the selected tile image over the
  // whole tilemap. Push the slot the frame-wait pops before handing it the one-frame count.
  yield* waitFrames(m, 1);

  const tileImage = (mem8[LEVEL] & 1) === 1 ? PLAYFIELD_TILE_IMAGE_LEVEL_ODD : PLAYFIELD_TILE_IMAGE_LEVEL_EVEN;
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[VIDEO_RAM_BASE + cell] = mem8[tileImage + cell];
  }

  // Let another frame pass, then tint the tile image with the fixed colour map.
  yield* waitFrames(m, 1);

  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[COLOR_RAM_BASE + cell] = mem8[PLAYFIELD_COLOUR_IMAGE + cell];
  }

  // Stamp the two fixed edge columns and repaint the score HUD over the new screen.
  drawLeftEdgeColumn(m);
  redrawScoreHud(m);
  drawRightEdgeColumn(m);

  // Arm the cell-animation counter so the per-frame recolour cycle begins.
  mem8[GLITTER_COUNTDOWN] = 1;

  // Model the return to the caller through the balanced work stack.
  return m.ret();
}
