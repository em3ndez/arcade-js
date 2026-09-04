// SPDX-License-Identifier: GPL-3.0-only
import { setGameActive } from "./setGameActive.js";
import { startSound } from "./startSound.js";
import { mainLoop } from "./mainLoop.js";

/**
 * enterRoundWithoutFieldReload — the field-arm tail that skips the field reload.
 *
 * WHAT IT IS
 *   The last leg of the round-start chain. It marks the game active, cues the round-start sound, and
 *   falls into the in-game frame loop — the same tail as enterRoundWithFieldReload (0x0814) but without
 *   the leading loadReferenceAlienState (0x00b1) call, so the alien field already in RAM is kept rather
 *   than reloaded from the saved record. This is the "doJ" re-entry the extra-life continuation uses.
 *
 * ROLE IN THE MACHINE
 *   Reached from doJFlow (the extra-life continuation: take one reserve ship, then re-enter the field
 *   without reloading it) and, per mechanisms.md, from the doJ arm of the round chain. It calls
 *   setGameActive (0x19d1 -> GAME_ACTIVE 0x20e9 := 1, the master gate the interrupt bodies test),
 *   startSound (0x18fa, which OR-masks 0x20 into the port-3 sound shadow and mirrors it to the sound
 *   port — the round-start cue), then yields into mainLoop (the in-game frame loop loc_081f). In the
 *   ROM this is loc_0817, which falls through into the loop body at 0x081f.
 *
 * ROM 0x0817-0x081e (falls into mainLoop at 0x081f).  Grounding: composed of [seen] leaves
 * (setGameActive, startSound); the enter-round spine itself carries no separate cert tag in names.js.
 *
 * LIVE-OUT: does not return during play — control lives in mainLoop until a handler arms a restart flow.
 * Generator; memory + IO.
 */
export function* enterRoundWithoutFieldReload(m) {
  // Raise the master game-active flag (GAME_ACTIVE 0x20e9 := 1) so the interrupt bodies run the play
  // field rather than falling straight to their epilogue.
  setGameActive(m);
  // Cue the round-start sound: OR bit-mask 0x20 into the port-3 sound shadow and mirror it out.
  startSound(m, 0x20);
  // Fall into the in-game frame loop; one pass per displayed frame until a handler hands off.
  yield* mainLoop(m);
}
