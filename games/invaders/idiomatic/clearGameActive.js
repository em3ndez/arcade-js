// SPDX-License-Identifier: GPL-3.0-only
import { storeGameActive } from "./storeGameActive.js";

/**
 * clearGameActive — drop the master "a game is live" flag.
 *
 * WHAT IT IS
 *   A one-line front door that writes 0 into GAME_ACTIVE (0x20e9), the single byte that records
 *   whether a game is currently running. Its sibling setGameActive writes 1 the same way.
 *
 * ROLE IN THE MACHINE
 *   GAME_ACTIVE is the gate both interrupt bodies check first: finding it zero, they fall straight to
 *   their epilogue without touching the play field. This clear is run on death, reset, credit-screen
 *   return, and player hand-off (its callers include drawCreditReadout, playerShipHandler, the
 *   tilt/reset handler, and startGameFlow). Both this and setGameActive funnel through the shared
 *   store storeGameActive, which does the actual memory write.
 *
 * ROM 0x19d7-...  Grounding: [seen].
 *
 * LIVE-OUT: memory (GAME_ACTIVE := 0); storeGameActive leaves the stored value in A.
 */
export function clearGameActive(m) {
  // Hand 0 to the shared accumulator-store tail, which writes it into GAME_ACTIVE (0x20e9).
  storeGameActive(m, 0);
}
