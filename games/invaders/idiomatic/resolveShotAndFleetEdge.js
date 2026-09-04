// SPDX-License-Identifier: GPL-3.0-only
import { resolvePlayerShotHit } from "./resolvePlayerShotHit.js";
import { reverseFleetAtEdge } from "./reverseFleetAtEdge.js";

/**
 * resolveShotAndFleetEdge — one main-loop pass's shot-collision resolve followed by the fleet edge turn.
 *
 * WHAT IT IS
 *   A two-step trampoline the in-game frame loop runs each pass: first settle whatever the player's
 *   in-flight shot hit, then let the fleet reverse and drop if it has reached a screen edge.
 *
 * ROLE IN THE MACHINE
 *   Called from mainLoop (see mechanisms.md "The in-game main loop and round restarts"), and also from
 *   the pre-round redraw trampoline updateFleetAndDrawCopyright. resolvePlayerShotHit (0x14d8) is the
 *   state-2 shot handler: gated on PLAYER_SHOT_STATUS==2 and a latched PLAYER_SHOT_HIT, it decides by
 *   the shot's Y whether the shot missed off the top, struck the saucer, or killed an alien (clearing
 *   the grid cell and queueing the score/sound). reverseFleetAtEdge (0x1597) then scans the edge column
 *   selected by FLEET_MOVE_DIR and, on a hit, flips the fleet direction and republishes the horizontal
 *   step and vertical drop. The two run back to back so a frame both resolves the hit and advances the
 *   march edge logic.
 *
 * ROM 0x190a.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: RAM only; callers ignore the returned value.
 */
export function resolveShotAndFleetEdge(m) {
  // Resolve the player shot's collision (miss / saucer / alien kill) for this frame.
  resolvePlayerShotHit(m);
  // Then run the fleet edge/direction update (reverse + drop when the leading edge hits a boundary).
  return reverseFleetAtEdge(m);
}
