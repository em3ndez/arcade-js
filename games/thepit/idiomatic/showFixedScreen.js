// SPDX-License-Identifier: GPL-3.0-only
/**
 * showFixedScreen — paint a canned full-screen image and hold it briefly. It puts one prebuilt
 * static screen up: the playfield is a fixed 32x32 tile picture, dropped on screen wholesale and
 * tinted one flat colour, then held so the player can read it. In order: run the blank-screen
 * setup and wait a frame, stamp the picture over the whole tilemap, flood the colour RAM with one
 * attribute, and hold the finished screen for 160 frames before returning to the caller. The final
 * hold is a tail call — its return unwinds straight to this routine's own caller.
 */
import { waitFrames } from "./waitFrames.js";
import { blankScreen } from "./blankScreen.js";
import { PREPLAY_FIXED_SCREEN_IMAGE } from "./names.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the per-tile colour RAM
const SCREEN_CELLS = 1024; // the whole 32x32 tilemap / colour RAM
const SCREEN_ATTRIBUTE = 147; // the one flat colour attribute painted across the whole screen

export function* showFixedScreen(m) {
  const { mem8 } = m;

  // 1. Blank the screen to the neutral background, then let a frame pass.
  blankScreen(m);
  m.push16(0x3b89);
  yield* waitFrames(m, 1);

  // 2. Stamp the prebuilt full-screen tile image over the blanked tilemap.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[VIDEO_RAM_BASE + cell] = mem8[PREPLAY_FIXED_SCREEN_IMAGE + cell];
  }

  // 3. Tint the entire display one flat colour.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[COLOR_RAM_BASE + cell] = SCREEN_ATTRIBUTE;
  }

  // 4. Hold the finished screen for 160 frames. A tail call: its return goes to our caller.
  return yield* waitFrames(m, 160);
}
