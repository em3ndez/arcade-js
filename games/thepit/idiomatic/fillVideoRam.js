import { VIDEO_RAM_LAST_CELL } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillVideoRam — paint every cell of the tilemap with one tile code.
 *
 * The screen-clear step of display setup. It reads a single fixed fill code and stamps
 * it into all 1024 cells of video RAM (the whole 32x32 tilemap), wiping whatever was on
 * screen to a uniform background before the setup that follows draws over it. The fill
 * code is not a literal: it is read once from a fixed constant cell, so whatever tile
 * sits there is what the screen fills with. A colour-map twin repaints colour after.
 */
export function fillVideoRam(m) {
  const { mem8 } = m;

  const fill = mem8[0x4b0f]; // the tile code to stamp into every cell

  // Paint all 1024 tilemap cells with the fill code.
  for (let cell = 0x9000; cell <= VIDEO_RAM_LAST_CELL; cell++) {
    mem8[cell] = fill;
  }
}
