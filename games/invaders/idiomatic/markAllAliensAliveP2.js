// SPDX-License-Identifier: GPL-3.0-only
import { markAllAliensAlive } from "./markAllAliensAlive.js";
import { ALIEN_FIELD_P2 } from "./names.js";

/**
 * markAllAliensAliveP2 — arm a fresh 55-alien wave in player two's field.
 *
 * WHAT IT IS
 *   The player-two front door to the alien-field reset. It seats the player-two liveness-grid base and
 *   hands off to markAllAliensAlive, which writes 0x01 into 0x37 (55) consecutive bytes — one live byte
 *   per alien, five rows of eleven — filling player two's grid with a full fresh fleet.
 *
 * ROLE IN THE MACHINE
 *   Twin of markAllAliensAliveP1 (which resets 0x2100). Each player owns a 256-byte page of work RAM for
 *   its aliens; the low 0x37 bytes are the liveness grid, nonzero while an alien is still on the board.
 *   This one names the player-two page base ALIEN_FIELD_P2 (0x2200) as a fixed constant rather than
 *   routing through ACTIVE_PLAYER_PAGE, so it always resets player two's grid regardless of who is
 *   currently in play — run when player two's round/wave is being set up.
 *
 * ROM 0x1904.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the 55-byte fill); the seam completes the ret.
 */
export function markAllAliensAliveP2(m) {
  // Seat the player-two grid base (0x2200) and fill its 55 liveness cells with 0x01 (all aliens alive).
  markAllAliensAlive(m, ALIEN_FIELD_P2);
}
