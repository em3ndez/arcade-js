// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpRoundAndHoldIntro — one-time round-start setup: make the selected player's saved
 * progress live, configure the round from the dip switches, unmute the audio, build the
 * board screen and play the start sound, then hold an intro before handing off to the
 * round-loop setup, which never returns here.
 *
 * The sequence: load the selected player's saved level/score into the shared live cells;
 * decode the dip switches into the round's difficulty/hardware configuration; switch the
 * master sound-enable line on; build the board screen (clear sprites, repaint the tilemap,
 * flood colour memory, wipe the sprite staging block); play the round-start sound; paint the
 * "MEN LEFT" panel once, then hold the intro for eight passes — each repaints the "PLAYERS"
 * label and one playfield strip, spaced by a ten-frame then five-frame wait, draining the
 * shared loop counter to zero; finally tail-jump to the round-loop setup, whose own return
 * carries this routine's caller. Which boundary this marks (new game, level, or player
 * changeover) is not pinned, so the name stays neutral.
 */

import { initRoundAndEnterMainLoop } from "./initRoundAndEnterMainLoop.js";
import { loadPlayerState } from "./loadPlayerState.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { enableSound } from "./enableSound.js";
import { setupBoardMode90 } from "./setupBoardMode90.js";
import { requestSound4 } from "./requestSound4.js";
import { drawMenLeftPanel } from "./drawMenLeftPanel.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { waitFrames } from "./waitFrames.js";
import { paintPlayfieldStripCol1Row11 } from "./paintPlayfieldStripCol1Row11.js";
import { LOOP_COUNTER } from "./names.js";

export function* setUpRoundAndHoldIntro(m) {
  const { mem8 } = m;

  // Bring up the round: make the player's progress live, configure from dip switches, unmute,
  // build the board screen, play the round-start sound.
  loadPlayerState(m);
  applyDipSwitches(m);
  enableSound(m);
  setupBoardMode90(m);
  requestSound4(m);

  // Hold the intro for eight passes: arm the count, paint "MEN LEFT" once, then each pass
  // repaints "PLAYERS" and one strip, spaced by a ten- and five-frame wait.
  mem8[LOOP_COUNTER] = 8;
  drawMenLeftPanel(m);
  do {
    drawPlayerLabel(m);
    yield* waitFrames(m, 10);
    paintPlayfieldStripCol1Row11(m);
    yield* waitFrames(m, 5);
    mem8[LOOP_COUNTER] = mem8[LOOP_COUNTER] - 1;
  } while (mem8[LOOP_COUNTER] !== 0);

  // Hand off to the round-loop setup; its return carries this routine's caller, so control
  // never comes back here. Kept as a call boundary since the target falls into the main loop.
  return yield* initRoundAndEnterMainLoop(m);
}
