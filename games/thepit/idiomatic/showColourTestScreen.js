// SPDX-License-Identifier: GPL-3.0-only
/**
 * showColourTestScreen — the DIP-selected colour/tile test pattern screen.  ROM 0x4f47.
 *
 * Reached only when the top DIP switch is set: the switch decode hands straight here
 * instead of starting attract, so this is the cabinet's service/test screen. It marks
 * the game mode as the test screen and blanks the whole display, then watches two
 * trigger inputs:
 *
 *   - While BOTH triggers are held, it runs a colour sweep. Each pass paints the entire
 *     tilemap with a running tile index that ramps 0..255 (so every one of the 256 tile
 *     shapes shows on screen, repeating every 256 cells) and floods the whole colour map
 *     with a single colour byte, holding the frame briefly between passes. The colour byte
 *     steps through the top half of its range (128 through 255), one value per pass — 128
 *     passes in all — so the test pattern visibly cycles through its colours. When the
 *     sweep finishes it restarts the attract cycle.
 *   - While the triggers are NOT both held, it re-decodes the DIP switches instead (which,
 *     with the test DIP still set, lands right back here), leaving the blanked screen up
 *     until the operator holds both triggers.
 *
 * Takes no inputs of its own and returns nothing a caller reads — its whole product is the
 * screen it paints (video + colour RAM) and the mode byte. Both exits are hand-offs: the
 * sweep tails into the reset/round-restart epilogue, the idle path into the DIP decode.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4f47.test.js.
 * GATE:     crafted-entry — only reached with the test DIP set, never in plain attract, so
 *           the entry is captured at a real DIP-decode (0x4b55) boot dispatch and the
 *           trigger-input byte poked to drive each branch. The sweep branch is stopped at
 *           the reset-epilogue hand-off so the painted test pattern is observable before
 *           the epilogue repaints over it. RAM diff outside the dead stack scratch.
 * LIVE-OUT: memory-only — the mode byte, the flooded video + colour RAM, the pass-colour
 *           scratch, and everything the screen-blank writes. Neither hand-off reads a
 *           register back from here.
 * NAMES:    GAME_STATE (0x8001), IN0_DEBOUNCED (0x8018) from names.js. The pass-colour scratch
 *           is COLOUR_TEST_FILL (0x8012); the video/colour RAM bases are fixed
 *           hardware regions kept as addresses. 0x4f61 / 0x4f7e are the frame-wait's resume
 *           slots (code addresses), pushed the way the still-stack-return frame-wait expects.
 */

import { blankScreen } from "./blankScreen.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { waitFrames } from "./waitFrames.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";
import { GAME_STATE, IN0_DEBOUNCED, COLOUR_TEST_FILL } from "./names.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOUR_RAM_BASE = 0x8800; // start of the matching per-cell colour map
const SCREEN_CELLS = 1024; // the whole 32x32 grid (0x9000..0x93ff, 0x8800..0x8bff)

export function* showColourTestScreen(m) {
  const { mem8 } = m;

  // Mark the mode as the test screen and blank the whole display.
  mem8[GAME_STATE] = 9;
  blankScreen(m);

  // The sweep only runs while both trigger inputs are held; otherwise re-decode the DIP
  // switches (which re-enters here while the test DIP stays set), leaving the blank up.
  const input = mem8[IN0_DEBOUNCED];
  const bothTriggersHeld = (input & 0x08) !== 0 && (input & 0x10) !== 0;
  if (!bothTriggersHeld) return applyDipSwitches(m);

  // Settle one frame before the first pass (the frame-wait returns through the work
  // stack, so push the slot it pops before handing it the count).
  m.push16(0x4f61);
  yield* waitFrames(m, 1);

  // Cycle the colour byte across the top half of its range (128 through 255), one value
  // per pass. Each pass repaints the full test pattern and holds a moment before the next.
  for (let fill = 128; fill <= 255; fill++) {
    mem8[COLOUR_TEST_FILL] = fill;
    for (let cell = 0; cell < SCREEN_CELLS; cell++) {
      mem8[VIDEO_RAM_BASE + cell] = cell; // low 8 bits = the ramping tile index, 0..255
      mem8[COLOUR_RAM_BASE + cell] = fill; // whole colour map set to this pass's colour
    }
    m.push16(0x4f7e);
    yield* waitFrames(m, 120);
  }

  // Sweep done: restart the attract cycle.
  return yield* resetStateAndShowSetup(m);
}
