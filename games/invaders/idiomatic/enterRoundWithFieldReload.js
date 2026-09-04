// SPDX-License-Identifier: GPL-3.0-only
import { loadReferenceAlienState } from "./loadReferenceAlienState.js";
import { setGameActive } from "./setGameActive.js";
import { startSound } from "./startSound.js";
import { mainLoop } from "./mainLoop.js";

/**
 * enterRoundWithFieldReload -- the field-arm tail that starts (or restarts) a round, reloading the field.
 *
 * WHAT IT IS
 *   The last stage of the round-start chain (startRoundFlow -> restoreShieldsAndEnterRound -> here). It
 *   loads the active player's saved alien field back into the working reference state, flips the machine
 *   into its live-game mode, cues the round-start sound, and falls into the per-frame in-game loop. The
 *   "WithFieldReload" name distinguishes it from enterRoundWithoutFieldReload (0x0817), the doJ extra-life
 *   re-entry that skips the field reload because the field is already live.
 *
 * ROLE IN THE MACHINE
 *   loadReferenceAlienState rebuilds the fleet reference corner (loc_2009/ALIEN_DRAW_ADDR and the derived
 *   count/direction) from the active player's page-top save record, so the fleet resumes where this player
 *   left off. setGameActive raises GAME_ACTIVE (0x20e9), the master gate both interrupt bodies test first.
 *   startSound(0x20) latches the round-start cue into the port-3 sound shadow. Then it yields into mainLoop
 *   (loc_081f), which runs one pass per displayed frame.
 *
 * ROM 0x0814.  Grounding: §4 clock-free spine generator (constituent leaves loadReferenceAlienState /
 * setGameActive / startSound carry [seen] certs; the spine wiring is exercised by the frame-stepped gate).
 *
 * LIVE-OUT: generator -- never returns normally; delegates forever into mainLoop. Memory + IO.
 */
export function* enterRoundWithFieldReload(m) {
  // Reload this player's saved fleet position/heading into the working reference state so the march resumes.
  loadReferenceAlienState(m);
  // Raise GAME_ACTIVE: from here the interrupt bodies run the in-game per-frame work rather than attract.
  setGameActive(m);
  // Latch the round-start sound cue (port-3 bit for mask 0x20) via the shared sound shadow.
  startSound(m, 0x20);
  // Fall into the in-game frame loop; each of its yields is one displayed frame driven by the interrupt.
  yield* mainLoop(m);
}
