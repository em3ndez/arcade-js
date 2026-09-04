// SPDX-License-Identifier: GPL-3.0-only
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { enterRoundWithoutFieldReload } from "./enterRoundWithoutFieldReload.js";

/**
 * doJFlow — the extra-life continuation flow ("doJ" re-entry).
 *
 * WHAT IT IS
 *   One of the three round-restart flows the player-ship handler can arm on the frame-timer's expiry
 *   (the others being newRoundFlow and gameOverFlow). This is the "extra life" path: the player still
 *   has ships in reserve, so it takes one ship out of the reserve readout and drops the player straight
 *   back into the field without reloading the saved alien field — the same wave continues.
 *
 * ROLE IN THE MACHINE
 *   Reached from the in-game main-loop restart dispatch (ROM loc_1a7f then enterRoundWithoutFieldReload).
 *   decrementShipsAndDrawReadout pulls one ship from the active player's reserve count and repaints the
 *   reserve-ship icon row and lives digit; enterRoundWithoutFieldReload then marks the game active, cues
 *   the round-start sound, and falls into mainLoop — but, unlike the field-reload entry, it skips
 *   loadReferenceAlienState so the fleet is left exactly where it was.
 *
 * ROM 0x1a7f (join) → enterRoundWithoutFieldReload.  Grounding: composite flow — no separate cert entry
 * in names.js; described in mechanisms.md §"The in-game main loop and round restarts". Its leaf step
 * decrementShipsAndDrawReadout (0x1a7f) is [seen].
 *
 * LIVE-OUT: this is a generator (function*): it yields through the frame loop rather than returning a
 *   register set. Touches RAM (ship count, game-active flag) and IO (the sound port).
 */
export function* doJFlow(m) {
  // Take one ship from the reserve: decrement the active player's stored reserve count and repaint the
  // reserve-ship icon row plus the lives digit so the readout reflects the ship now entering play.
  decrementShipsAndDrawReadout(m);
  // Re-arm the field WITHOUT reloading the saved alien field: mark the game active, cue the round-start
  // sound, and yield into the in-game frame loop, resuming the wave already in progress.
  yield* enterRoundWithoutFieldReload(m);
}
