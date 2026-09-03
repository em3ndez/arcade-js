// SPDX-License-Identifier: GPL-3.0-only
import { bcdAddByte } from "../../../core/bcd.js";
import { drawCreditCount } from "./drawCreditCount.js";
import { drawPlayer1Score } from "./drawPlayer1Score.js";
import { drawPlayer2Score } from "./drawPlayer2Score.js";
import { clearGameActive } from "./clearGameActive.js";
import { redrawScorePanel } from "./redrawScorePanel.js";
import { initPlayer1ShieldBuffers } from "./initPlayer1ShieldBuffers.js";
import { initPlayer2ShieldBuffers } from "./initPlayer2ShieldBuffers.js";
import { readStartingShips } from "./readStartingShips.js";
import { loc_00d7 } from "./loc_00d7.js";
import { markAllAliensAliveP1 } from "./markAllAliensAliveP1.js";
import { markAllAliensAliveP2 } from "./markAllAliensAliveP2.js";
import { seedWorkRamImage } from "./seedWorkRamImage.js";
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { loc_07f9 } from "./loc_07f9.js";
import {
  TWO_PLAYER_GAME, CREDIT_COUNT, PLAYER1_OBJ_DESC, PLAYER2_OBJ_DESC, GAME_IN_PROGRESS,
  loc_20e5, loc_20e7, loc_21fc, loc_21fe, loc_21ff, loc_22fc, loc_22fe, loc_22ff,
} from "./names.js";

// Shared game-start init (one- or two-player). Record the player-count flag, deduct the started game's
// credits from the tally (BCD) and repaint it, zero both score records and redraw them, drop the
// game-active flag while raising game-in-progress, seed the per-player score cursors, republish the whole
// score panel, and lay in the shield buffers. Read the starting-ship count from the option switches into
// both player records, clear the fixed strip, mark every alien alive for both players, seat both player
// object records at their spawn cell, reseed work RAM from its template, take the first ship into play
// (updating the reserve readout), then fall into the round-start entry. Generator; memory + IO.
export function* loc_079b(m, twoPlayerFlag, creditDelta) {
  m.mem8[TWO_PLAYER_GAME] = twoPlayerFlag;
  m.mem8[CREDIT_COUNT] = bcdAddByte(m.mem8[CREDIT_COUNT], creditDelta).value;
  drawCreditCount(m);

  m.mem8[PLAYER1_OBJ_DESC] = 0x00;
  m.mem8[PLAYER1_OBJ_DESC + 1] = 0x00;
  m.mem8[PLAYER2_OBJ_DESC] = 0x00;
  m.mem8[PLAYER2_OBJ_DESC + 1] = 0x00;
  drawPlayer1Score(m);
  drawPlayer2Score(m);
  clearGameActive(m);

  m.mem8[GAME_IN_PROGRESS] = 0x01;
  m.mem8[loc_20e7] = 0x01;
  m.mem8[loc_20e7 + 1] = 0x01;
  m.mem8[loc_20e5] = 0x01;
  m.mem8[loc_20e5 + 1] = 0x01;
  redrawScorePanel(m);
  initPlayer1ShieldBuffers(m);
  initPlayer2ShieldBuffers(m);

  const ships = readStartingShips(m);
  m.mem8[loc_21ff] = ships;
  m.mem8[loc_22ff] = ships;
  loc_00d7(m);
  m.mem8[loc_21fe] = 0x00;
  m.mem8[loc_22fe] = 0x00;
  markAllAliensAliveP1(m);
  markAllAliensAliveP2(m);

  m.mem8[loc_21fc] = 0x78;
  m.mem8[loc_21fc + 1] = 0x38;
  m.mem8[loc_22fc] = 0x78;
  m.mem8[loc_22fc + 1] = 0x38;
  seedWorkRamImage(m);
  decrementShipsAndDrawReadout(m);

  yield* loc_07f9(m);
}
