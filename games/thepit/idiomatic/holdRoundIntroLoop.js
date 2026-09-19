// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdRoundIntroLoop — the round-start intro-hold loop: repaint the "PLAYERS" HUD label and one
 * playfield strip, spaced by two short frame-waits, for a caller-armed number of passes, then
 * hand off to the round-loop setup. Entered both by falling through from the round-start setup
 * and by looping back on itself. Each pass repaints the label and one strip, then holds — a
 * ten-frame and a five-frame wait — so the board sits on screen before play. The pass count
 * drains LOOP_COUNTER, running a pass first and decrementing after, so at least one pass always
 * runs and a counter left at zero wraps to a full 256 passes. At zero it tail-jumps to the
 * round-loop setup, whose return carries this routine's caller. Which round boundary this intro
 * belongs to is not pinned, so the name stays neutral.
 */

import { initRoundAndEnterMainLoop } from "./initRoundAndEnterMainLoop.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { waitFrames } from "./waitFrames.js";
import { paintPlayfieldStripCol1Row11 } from "./paintPlayfieldStripCol1Row11.js";
import { LOOP_COUNTER } from "./names.js";

export function* holdRoundIntroLoop(m) {
  const { mem8 } = m;

  // Run one pass, then drain the counter; the frame-waits return through the work stack.
  do {
    drawPlayerLabel(m);
    yield* waitFrames(m, 10);
    paintPlayfieldStripCol1Row11(m);
    yield* waitFrames(m, 5);
    mem8[LOOP_COUNTER] = mem8[LOOP_COUNTER] - 1;
  } while (mem8[LOOP_COUNTER] !== 0);

  // Hand off to the round-loop setup; its return carries this routine's caller.
  return yield* initRoundAndEnterMainLoop(m);
}
