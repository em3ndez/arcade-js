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

// The credit-inserted screen: once a coin has banked a credit while the attract demo runs, this becomes
// the foreground flow. Re-enable interrupts, mark the credit screen shown so it is not re-armed, repaint
// the credit readout, clear the play-field, and draw the top prompt. Then each frame redraw the start
// prompt and poll the start buttons -- a single credit offers a one-player start; two or more credits show
// the two-player prompt as well and accept a two-player start. On a start press, hand off to the matching
// game-start init. Generator; one poll per frame; memory + IO.
export function* creditScreen(m) {
  m.mem8[CREDIT_SCREEN_SHOWN] = 0x01;
  m.io.setInte(true);
  drawCreditReadout(m);
  clearPlayfield(m);
  drawSpriteList(m, loc_1ff3, 0x04, loc_3013);

  for (;;) {
    if (((m.mem8[CREDIT_COUNT] - 1) & 0xff) !== 0) {
      // two or more credits: the two-player select prompt
      drawSpriteList(m, loc_1aba, 0x14, loc_2810);
      const in1 = m.io.portIn(0x01);
      if (in1 & 0x02) { yield* startTwoPlayerGame(m); return; } // two-player start
      if (in1 & 0x04) { yield* startOnePlayerGame(m); return; } // one-player start
    } else {
      // a single credit: only the one-player start prompt
      drawSpriteList(m, loc_1acf, 0x14, loc_2810);
      if (m.io.portIn(0x01) & 0x04) { yield* startOnePlayerGame(m); return; } // one-player start
    }
    yield;
  }
}
