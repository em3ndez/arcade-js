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
import { startRoundFlow } from "./startRoundFlow.js";
import {
  TWO_PLAYER_GAME, CREDIT_COUNT, PLAYER1_OBJ_DESC, PLAYER2_OBJ_DESC, GAME_IN_PROGRESS,
  EXTRA_SHIP_AWARD_FLAG, loc_20e7, loc_21fc, PLAYER1_ROUND_COUNTER, PLAYER1_SHIP_COUNT, PLAYER2_FLEET_REF_COORD, loc_22fe, PLAYER2_SHIPS,
} from "./names.js";

/**
 * startGameFlow — the shared one-or-two-player game-start initialisation.
 *
 * WHAT IT IS
 *   The single setup body both start buttons run when a coin has been inserted and the player presses
 *   start. It records the player count, charges the credits, zeroes and repaints both score lines, lays
 *   in fresh shields, resets both players' alien fields and object records, reads the starting-ship
 *   count from the dip switches, takes the first ship into play, and then falls into the round-start
 *   chain that shows the splash and enters the in-game loop.
 *
 * ROLE IN THE MACHINE
 *   Entered from creditScreen via startOnePlayerGame (twoPlayerFlag 0x00, creditDelta 0x99 = BCD -1) or
 *   startTwoPlayerGame (0x01 / 0x98 = BCD -2) — see mechanisms.md "The in-game main loop and round
 *   restarts". It seeds RAM for BOTH players regardless of mode so a two-player game is fully armed:
 *   the two score descriptors (PLAYER1_OBJ_DESC 0x20f8 / PLAYER2_OBJ_DESC 0x20fc), both shield buffers,
 *   both alien fields (markAllAliensAliveP1/P2), and the per-player cells in each player's RAM page
 *   (page:0xfc coordinate word loc_21fc/PLAYER2_FLEET_REF_COORD, page:0xfe round counter PLAYER1_ROUND_COUNTER/loc_22fe, page:0xff
 *   reserve-ship count PLAYER1_SHIP_COUNT/PLAYER2_SHIPS). The two flag pairs loc_20e7 and EXTRA_SHIP_AWARD_FLAG (one byte per
 *   player) are seeded 0x01/0x01; the EXTRA_SHIP_AWARD_FLAG pair is the extra-ship-award flag awardExtraShip later
 *   reads and clears, and the loc_20e7 pair's exact role is not yet pinned down. TWO_PLAYER_GAME (0x20ce)
 *   records the mode, GAME_IN_PROGRESS (0x20ef) is raised, GAME_ACTIVE is dropped (clearGameActive) —
 *   the round-start chain raises it — and CREDIT_COUNT (0x20eb) is BCD-adjusted and repainted.
 *
 * ROM 0x079b-0x07f8 (translated/loc_079b.js), fallen into from the credit-prompt seaters loc_0798
 *   (1P) and loc_086d (2P).  Grounding: spine flow — no per-routine cert in names.js ROUTINES; every
 *   constituent helper it calls is [seen], and the coin -> prompt -> start -> game path is described in
 *   mechanisms.md.
 *
 * LIVE-OUT: none for callers — a terminal start flow that yields into startRoundFlow. Generator
 *   (startRoundFlow's splash/preamble span many frames); touches memory + IO.
 */
export function* startGameFlow(m, twoPlayerFlag, creditDelta) {
  // Record the player-count mode, then charge the started game's credits: BCD-add creditDelta into the
  // credit tally (0x99 subtracts one, 0x98 subtracts two via ten's-complement) and repaint the readout.
  m.mem8[TWO_PLAYER_GAME] = twoPlayerFlag;
  m.mem8[CREDIT_COUNT] = bcdAddByte(m.mem8[CREDIT_COUNT], creditDelta).value;
  drawCreditCount(m);

  // Zero both players' score value words (the first two bytes of each descriptor), redraw both score
  // lines from the now-zero records, and drop GAME_ACTIVE (the round-start chain re-raises it).
  m.mem8[PLAYER1_OBJ_DESC] = 0x00;
  m.mem8[PLAYER1_OBJ_DESC + 1] = 0x00;
  m.mem8[PLAYER2_OBJ_DESC] = 0x00;
  m.mem8[PLAYER2_OBJ_DESC + 1] = 0x00;
  drawPlayer1Score(m);
  drawPlayer2Score(m);
  clearGameActive(m);

  // Raise the game-in-progress flag and seed the two per-player flag pairs to 0x01/0x01: loc_20e7 (role
  // open) and EXTRA_SHIP_AWARD_FLAG (the extra-ship-award-available flag awardExtraShip reads and later clears).
  // Then repaint the whole score panel and lay in fresh shield buffers for both players.
  m.mem8[GAME_IN_PROGRESS] = 0x01;
  m.mem8[loc_20e7] = 0x01;
  m.mem8[loc_20e7 + 1] = 0x01;
  m.mem8[EXTRA_SHIP_AWARD_FLAG] = 0x01;
  m.mem8[EXTRA_SHIP_AWARD_FLAG + 1] = 0x01;
  redrawScorePanel(m);
  initPlayer1ShieldBuffers(m);
  initPlayer2ShieldBuffers(m);

  // Read the starting-ship count from the dip switches (readStartingShips = (port2 & 3) + 3, i.e. 3..6)
  // and stow it as both players' reserve-ship count (page:0xff, PLAYER1_SHIP_COUNT / PLAYER2_SHIPS). loc_00d7 seeds the
  // per-player fleet-delta cells and blanks the fixed strip; then zero both players' round counters
  // (page:0xfe, PLAYER1_ROUND_COUNTER / loc_22fe) for a fresh game.
  const ships = readStartingShips(m);
  m.mem8[PLAYER1_SHIP_COUNT] = ships;
  m.mem8[PLAYER2_SHIPS] = ships;
  loc_00d7(m);
  m.mem8[PLAYER1_ROUND_COUNTER] = 0x00;
  m.mem8[loc_22fe] = 0x00;
  markAllAliensAliveP1(m);
  markAllAliensAliveP2(m);

  // Seat both players' field-save coordinate word (page:0xfc, loc_21fc / PLAYER2_FLEET_REF_COORD) to the initial fleet
  // reference corner 0x3878 (low byte 0x78, high 0x38), then reseed work RAM from its ROM template.
  m.mem8[loc_21fc] = 0x78;
  m.mem8[loc_21fc + 1] = 0x38;
  m.mem8[PLAYER2_FLEET_REF_COORD] = 0x78;
  m.mem8[PLAYER2_FLEET_REF_COORD + 1] = 0x38;
  seedWorkRamImage(m);
  // Take the first ship into play (decrement the reserve count and repaint the ships readout).
  decrementShipsAndDrawReadout(m);

  // Fall into the round-start chain (splash -> field/shield preamble -> in-game loop).
  yield* startRoundFlow(m);
}
