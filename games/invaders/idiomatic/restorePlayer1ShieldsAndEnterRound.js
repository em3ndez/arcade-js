// SPDX-License-Identifier: GPL-3.0-only
import { restorePlayer1Shields } from "./restorePlayer1Shields.js";
import { enterRoundWithFieldReload } from "./enterRoundWithFieldReload.js";

/**
 * restorePlayer1ShieldsAndEnterRound — the player-1 arm of the round-start shield/field preamble.
 *
 * WHAT IT IS
 *   When a round begins for player one, this paints that player's saved bunker shields back onto the
 *   screen and then falls straight into the shared field-arm tail that reloads the alien field, marks
 *   the game active, cues the round-start sound, and enters the in-game loop. It is one branch of the
 *   preamble: player one takes this path, player two is handled inline by the caller.
 *
 * ROLE IN THE MACHINE
 *   Reached from restoreShieldsAndEnterRound (0x0804-0x0813) when bit 0 of ACTIVE_PLAYER_PAGE is set
 *   (player one). Its two steps:
 *     1. restorePlayer1Shields (0x021a) forces the shield mode flag to restore and OR-blits the
 *        player-1 shields back from PLAYER1_SHIELD_BUFFER (0x2142) — so bunker damage persists across
 *        turns.
 *     2. enterRoundWithFieldReload (the field-arm tail) reloads the saved reference-alien field
 *        (loadReferenceAlienState), sets GAME_ACTIVE, fires startSound(0x20), and yields into mainLoop.
 *   A generator because the tail runs the per-frame game loop, which yields once per displayed frame.
 *
 * ROM: idiomatic composite of the two routines above (no single distinct ROM entry).  Grounding: the
 *   constituents are [seen].
 *
 * LIVE-OUT: control passes into the in-game frame loop; memory + IO effects of the two steps.
 */
export function* restorePlayer1ShieldsAndEnterRound(m) {
  // Repaint player one's saved bunkers (restore mode) before the round starts.
  restorePlayer1Shields(m);
  // Join the shared field-arm tail: reload the field, activate the game, cue sound, run mainLoop.
  yield* enterRoundWithFieldReload(m);
}
