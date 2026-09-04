// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * readActivePlayerInput -- sample the input port belonging to whichever player is on the machine.
 *
 * WHAT IT IS
 *   Space Invaders wires player 1's controls to hardware input port 1 and player 2's to port 2. This
 *   routine reads the one that belongs to the active player and returns the raw port byte.
 *
 * ROLE IN THE MACHINE
 *   ACTIVE_PLAYER_PAGE (0x2067) names the current player: its low bit is the player selector (set = player
 *   1, clear = player 2). This routine tests that bit and reads IN1 for player 1 or IN2 for player 2 --
 *   the same selector currentPlayerRecordPtr and readActivePlayerInput's callers use elsewhere. The result
 *   feeds the ship-movement / fire logic so each player drives from their own joystick and button.
 *
 * ROM 0x17c0.  Grounding: [seen].
 *
 * LIVE-OUT: A = the sampled input-port byte.
 */
export function readActivePlayerInput(m) {
  // Low bit of the player-select byte picks the port: set -> IN1 (player 1), clear -> IN2 (player 2).
  return (m.regs.a = m.io.portIn(m.mem8[ACTIVE_PLAYER_PAGE] & 0x01 ? 0x01 : 0x02));
}
