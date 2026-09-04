// SPDX-License-Identifier: GPL-3.0-only
import { drawBottomLine } from "./drawBottomLine.js";
import { restorePlayer2Shields } from "./restorePlayer2Shields.js";
import { restorePlayer1ShieldsAndEnterRound } from "./restorePlayer1ShieldsAndEnterRound.js";
import { enterRoundWithFieldReload } from "./enterRoundWithFieldReload.js";
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * restoreShieldsAndEnterRound — the shield/field preamble that arms a round for the active player.
 *
 * WHAT IT IS
 *   The middle stage of the round-start chain. It repaints the bottom ground line, restores the active
 *   player's saved bunker shields back onto the screen, and then falls into the field-arm tail that loads
 *   the alien field and enters the in-game loop. Which player's shields are restored is chosen by the
 *   active-player select bit. It is a generator (memory + IO), yielding through the busy-wait/field stages.
 *
 * ROLE IN THE MACHINE
 *   The round-start chain is startRoundFlow -> restoreShieldsAndEnterRound -> enterRoundWithFieldReload /
 *   enterRoundWithoutFieldReload (see mechanisms.md, "The in-game main loop and round restarts"); the
 *   next-round handoff advanceToNextRound also re-enters here. ACTIVE_PLAYER_PAGE (0x2067) names the RAM
 *   page and, in its low bit, which player is on the machine: bit 0 set = player 1, clear = player 2 (the
 *   8080 rotates that bit into carry to branch). Each player owns a shield backup buffer inside its own
 *   page, so restoring persists that player's bunker damage across turns. On the player-1 branch this
 *   delegates to restorePlayer1ShieldsAndEnterRound (which restores and joins the field-arm tail). On the
 *   player-2 branch it restores here, repaints the bottom line a second time, and falls into
 *   enterRoundWithFieldReload directly.
 *
 * ROM 0x0804-0x0813.  Grounding: [code] (read from the routine body / translated loc_0804; the shield and
 * field routines it calls are each [seen] in names.js).
 *
 * LIVE-OUT: memory + IO; control continues into the field-arm tail and thence the in-game frame loop.
 */
export function* restoreShieldsAndEnterRound(m) {
  // Repaint the full-width bottom ground line (it was wiped by the play-field clear upstream).
  drawBottomLine(m);

  // Branch on the active-player select bit. Bit 0 set = player 1: hand off to the player-1 restore arm,
  // which restores that player's shields and enters the round, then we are done.
  if (m.mem8[ACTIVE_PLAYER_PAGE] & 1) {
    yield* restorePlayer1ShieldsAndEnterRound(m);
    return;
  }

  // Player-2 path: restore player 2's shields into the field here.
  restorePlayer2Shields(m);

  // Repaint the bottom line again (the shield restore touches the lower screen), then fall into the
  // field-arm tail that reloads the saved alien field, marks the game active, cues sound, and enters the loop.
  drawBottomLine(m);
  yield* enterRoundWithFieldReload(m);
}
