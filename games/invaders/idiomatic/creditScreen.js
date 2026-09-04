// SPDX-License-Identifier: GPL-3.0-only
import { drawCreditReadout } from "./drawCreditReadout.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { drawSpriteList } from "./drawSpriteList.js";
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { startTwoPlayerGame } from "./startTwoPlayerGame.js";
import {
  CREDIT_SCREEN_SHOWN, CREDIT_COUNT,
  loc_1ff3, loc_3013, loc_1acf, loc_1aba, loc_2810,
} from "./names.js";

// creditScreen — the coin-inserted "press start" screen that stands between attract and a game.
//
// WHAT IT IS
//   Once a coin has banked a credit while the attract demo runs, the vblank body hands off here. It sets
//   up the credit screen once, then spins one poll per displayed frame watching the start buttons: with a
//   single credit it offers only a one-player start; with two or more it also shows the two-player prompt
//   and accepts a two-player start. On a start press it hands off to the matching game-start init and
//   returns, ending the poll.
//
// ROLE IN THE MACHINE
//   Setup: latch CREDIT_SCREEN_SHOWN (0x2093) so the screen is drawn once and not re-armed, EI, repaint
//   the credit readout, clear the play-field, and draw the top prompt (loc_1ff3 -> loc_3013). The credit
//   tally is CREDIT_COUNT (0x20eb), a BCD count the coin ISR banks on the coin-switch press edge. Each
//   frame the prompt is redrawn and input port 1 polled: bit 2 (0x04) = one-player start, bit 1 (0x02) =
//   two-player start. startOnePlayerGame / startTwoPlayerGame seed the player count and score-line
//   constants through the shared init startGameFlow, which falls into the round-start chain. Running this
//   as a generator (one `yield` per frame) is what lets the multi-frame button poll live outside the
//   interrupt body — the original callFrozenLeaf hung the ISR here.
//
// ROM 0x0765 (folds the two-player sibling at 0x0857).  Grounding: [seen] (spine; in-game MAME
// convergence confirmed).
//
// LIVE-OUT: none — control passes into a game-start init on a start press.
export function* creditScreen(m) {
  // One-time setup. Latch the shown flag first so the screen is not re-armed, re-enable interrupts, then
  // paint the fixed furniture: the credit readout, a cleared play-field, and the top prompt (4 glyphs from
  // loc_1ff3 to screen slot loc_3013).
  m.mem8[CREDIT_SCREEN_SHOWN] = 0x01;
  m.io.setInte(true);
  drawCreditReadout(m);
  clearPlayfield(m);
  drawSpriteList(m, loc_1ff3, 0x04, loc_3013);

  // Poll loop: one pass per displayed frame (the `yield` at the bottom marks the frame boundary).
  for (;;) {
    // Branch on the credit tally. (CREDIT_COUNT - 1) != 0 means the count is not exactly 1 — i.e. two or
    // more credits are banked — so the two-player start is offered as well as one-player.
    if (((m.mem8[CREDIT_COUNT] - 1) & 0xff) !== 0) {
      // Two-or-more-credits prompt: draw the two-player select text (0x14 glyphs from loc_1aba to the
      // shared credit-screen text slot loc_2810), then read input port 1 once for this frame.
      // two or more credits: the two-player select prompt
      drawSpriteList(m, loc_1aba, 0x14, loc_2810);
      const in1 = m.io.portIn(0x01);
      // Start buttons on port 1: bit 1 (0x02) begins a two-player game, bit 2 (0x04) a one-player game.
      // Either press hands off to the game-start init and returns, ending the poll.
      if (in1 & 0x02) { yield* startTwoPlayerGame(m); return; } // two-player start
      if (in1 & 0x04) { yield* startOnePlayerGame(m); return; } // one-player start
    } else {
      // Single-credit prompt: only a one-player start is possible, so draw just that prompt (0x14 glyphs
      // from loc_1acf to loc_2810) and accept only the one-player start button (port 1 bit 2, 0x04).
      // a single credit: only the one-player start prompt
      drawSpriteList(m, loc_1acf, 0x14, loc_2810);
      if (m.io.portIn(0x01) & 0x04) { yield* startOnePlayerGame(m); return; } // one-player start
    }
    // No start pressed this frame: surrender to the next frame and poll again.
    yield;
  }
}
