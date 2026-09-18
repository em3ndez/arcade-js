// SPDX-License-Identifier: GPL-3.0-only
/**
 * showColourTestScreen — the DIP-selected colour/tile test-pattern screen (the cabinet's
 * service/test screen).
 *
 * Reached only when the top DIP switch is set: the switch decode hands straight here instead of
 * starting attract. It marks GAME_STATE as the test screen and blanks the display, then watches two
 * trigger inputs (IN0_DEBOUNCED). While BOTH triggers are held it runs a colour sweep — each pass
 * paints the tilemap with a tile index ramping 0..255 and floods the colour map with one colour
 * byte (COLOUR_TEST_FILL), holding briefly between passes; the colour steps through the top half of
 * its range (128..255), one value per pass, then the sweep restarts the attract cycle. While the
 * triggers are not both held it re-decodes the DIP switches (landing back here while the test DIP
 * stays set), leaving the blanked screen up.
 */

import { blankScreen } from "./blankScreen.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { waitFrames } from "./waitFrames.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";
import { GAME_STATE, IN0_DEBOUNCED, COLOUR_TEST_FILL } from "./names.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOUR_RAM_BASE = 0x8800; // start of the matching per-cell colour map
const SCREEN_CELLS = 1024;

export function* showColourTestScreen(m) {
  const { mem8 } = m;

  // Mark the mode as the test screen and blank the whole display.
  mem8[GAME_STATE] = 9;
  blankScreen(m);

  // Run the sweep only while both triggers are held; otherwise re-decode the DIP switches.
  const input = mem8[IN0_DEBOUNCED];
  const bothTriggersHeld = (input & 0x08) !== 0 && (input & 0x10) !== 0;
  if (!bothTriggersHeld) return applyDipSwitches(m);

  // Settle one frame before the first pass (push the slot the frame-wait pops).
  m.push16(0x4f61);
  yield* waitFrames(m, 1);

  // Cycle the colour byte across the top half of its range (128..255), one value per pass; each
  // pass repaints the full pattern (low 8 bits are the ramping tile index) and holds a moment.
  for (let fill = 128; fill <= 255; fill++) {
    mem8[COLOUR_TEST_FILL] = fill;
    for (let cell = 0; cell < SCREEN_CELLS; cell++) {
      mem8[VIDEO_RAM_BASE + cell] = cell;
      mem8[COLOUR_RAM_BASE + cell] = fill;
    }
    m.push16(0x4f7e);
    yield* waitFrames(m, 120);
  }

  // Sweep done: restart the attract cycle.
  return yield* resetStateAndShowSetup(m);
}
