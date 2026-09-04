// SPDX-License-Identifier: GPL-3.0-only
import { storeGameActive } from "./storeGameActive.js";

/**
 * setGameActive — raise the master "game is live" flag.
 *
 * WHAT IT IS
 *   Stores 1 into GAME_ACTIVE (0x20e9) by handing 1 to the shared storeGameActive tail. Its twin
 *   clearGameActive hands 0 to the same tail.
 *
 * ROLE IN THE MACHINE
 *   GAME_ACTIVE is the single byte that records whether a game is live, and everything downstream treats
 *   it as the master gate: both interrupt bodies load it first and, finding it zero, fall straight to
 *   their epilogue without touching the play field. This raises it where a game or round begins — it is
 *   called from enterRoundWithFieldReload / enterRoundWithoutFieldReload and returnToAttractFlow.
 *
 * ROM 0x19d1.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (GAME_ACTIVE = 1); the shared store completes the ret.
 */
export function setGameActive(m) {
  // Write 1 -> GAME_ACTIVE through the shared store, marking the game live.
  storeGameActive(m, 1);
}
