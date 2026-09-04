// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_FIELD_P1 } from "./names.js";
import { markAllAliensAlive } from "./markAllAliensAlive.js";

/**
 * markAllAliensAliveP1 — arm a fresh wave for player one.
 *
 * WHAT IT IS
 *   Points the alien-liveness fill at player one's field base and calls the shared filler, which writes
 *   0x01 into 0x37 (55) consecutive bytes — fifty-five live aliens laid down as five rows of eleven.
 *
 * ROLE IN THE MACHINE
 *   Each player owns a 256-byte page of work RAM for its aliens; the low 0x37 bytes are the liveness
 *   grid, one byte per alien, nonzero while that alien is on the board. ALIEN_FIELD_P1 (0x2100) is
 *   player one's page base. This is one of two thin seaters (markAllAliensAliveP2 points at 0x2200);
 *   note it names the page base as a fixed constant rather than going through ACTIVE_PLAYER_PAGE, so it
 *   always resets player one's grid regardless of who is currently active. Run at round setup — the
 *   attract demo (runAttractCycle) and game round starts arm the wave through it.
 *
 * ROM 0x01c0.  Grounding: [seen] (ALIEN_FIELD_P1 is [seen]).
 *
 * LIVE-OUT: memory only (0x2100-0x2136 filled with 0x01).
 */
export function markAllAliensAliveP1(m) {
  // Seat player one's field base (0x2100) and fill 0x37 alien cells with 0x01 (all alive).
  markAllAliensAlive(m, ALIEN_FIELD_P1);
}
