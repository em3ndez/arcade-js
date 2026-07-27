// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillVideoRam — paint every cell of the tilemap with one tile code.  ROM 0x4c27.
 *
 * The screen-clear step of display setup. It reads a single fixed fill code and
 * stamps it into all 1024 cells of video RAM (0x9000..0x93FF, the whole 32x32
 * tilemap), wiping whatever was on screen to a uniform background before the setup
 * that follows draws the new screen on top.
 *
 * The fill code is not a literal — it is read once from a fixed ROM constant, so
 * whatever tile sits there is what the screen fills with. The display-setup entries
 * (loc_4b3c / loc_4b40 / blankScreen) call this between their two other setup fills, and
 * its colour-RAM twin (loc_4c37) repaints colour the same way straight afterward.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c27.test.js.
 * GATE:     every real attract dispatch checked on the full contract (RAM + pc + SP);
 *           reached at display setup (cold boot -> blankScreen -> here) and each round
 *           setup, first entry within the opening frames of attract. Plus a
 *           full-region coverage check (a sentinel pre-seed proves every in-region
 *           cell is written and nothing outside it). Teeth: a short-fill twin that
 *           stops one page early.
 * LIVE-OUT: memory-only — the painted tilemap cells. The leftover value registers are
 *           dead: the return lands back in blankScreen, whose very next call (loc_4c37)
 *           reloads all of them before any read.
 * NAMES:    none from ram.js. 0x9000..0x93FF is the video-RAM (tilemap) span and
 *           0x4b0f is a ROM constant holding the fill code — both kept hex (neither
 *           has a ram.js name).
 */
export function fillVideoRam(m) {
  const { mem8 } = m;

  const fill = mem8[0x4b0f]; // the tile code to stamp into every cell

  // Paint all 1024 tilemap cells with the fill code.
  for (let cell = 0x9000; cell <= 0x93ff; cell++) {
    mem8[cell] = fill;
  }
}
