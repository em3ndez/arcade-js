// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdFixedScreen — paint a canned full-screen image, then hold it on display forever.
 *
 * Puts one prebuilt static screen up and never leaves it — a terminal "hold this screen" state,
 * escaped only by the watchdog reset on hardware. It is the never-returning sibling of
 * showFixedScreen, which shows its screen for a fixed spell and returns; this one shows its screen
 * and stays. In order it: waits a single frame so the previous display setup settles; copies a
 * prebuilt full-screen tile image into the entire tilemap, one tile per cell; floods the whole colour
 * memory with one flat background attribute, paints three accent colour strips down the playfield,
 * and draws the fixed setup/credits panel; then loops forever, each pass advancing one column's
 * colour a step (a slow colour-cycle shimmer), holding for 15 frames, and re-reading the cabinet DIP
 * switches so an operator's setting changes take effect while the screen is up. Control never returns.
 */

import { waitFrames } from "./waitFrames.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { drawSetupCreditsPanel } from "./drawSetupCreditsPanel.js";
import { cycleStagedColumnColour } from "./cycleStagedColumnColour.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { CREDIT_STANDBY_SCREEN_IMAGE } from "./names.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the per-tile colour RAM
const SCREEN_CELLS = 1024; // the whole 32x32 tilemap / colour RAM
const BACKGROUND_ATTRIBUTE = 2; // the flat colour flooded across the whole screen before the strips

// The three accent colour strips: [column offset from the colour-RAM top-of-column anchor, colour].
const ACCENT_STRIPS = [
  [18, 7],
  [22, 4],
  [26, 6],
];

export function* holdFixedScreen(m) {
  const { mem8 } = m;

  // 1. Let the previous display setup settle for one frame (hand the wait its resume address).
  yield* waitFrames(m, 1);

  // 2. Stamp the prebuilt full-screen tile image over the tilemap.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[VIDEO_RAM_BASE + cell] = mem8[CREDIT_STANDBY_SCREEN_IMAGE + cell];
  }

  // 3. Flood the whole display one flat background colour, then paint the three accent
  //    colour strips over it and draw the fixed setup/credits panel.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[COLOR_RAM_BASE + cell] = BACKGROUND_ATTRIBUTE;
  }
  for (const [columnOffset, colour] of ACCENT_STRIPS) {
    fillColourColumnAt(m, columnOffset, colour);
  }
  drawSetupCreditsPanel(m);

  // 4. Hold the finished screen forever: shimmer one column's colour a step, wait 15 frames, and
  //    re-decode the DIP switches. This loop never exits, so the routine never returns.
  for (;;) {
    cycleStagedColumnColour(m);

    yield* waitFrames(m, 15);

    applyDipSwitches(m);
  }
}
