// SPDX-License-Identifier: GPL-3.0-only
import { GAME_ACTIVE } from "./names.js";

/**
 * storeGameActive — the shared write to the game-active flag.
 *
 * WHAT IT IS
 *   Writes the accumulator into GAME_ACTIVE (0x20e9), the single byte that records whether a game is
 *   live. It is a bare tail: the value comes from A (the caller supplies it, defaulting to m.regs.a).
 *
 * ROLE IN THE MACHINE
 *   Both public setters funnel through here: setGameActive (0x19d1) hands it 1, clearGameActive (0x19d7)
 *   hands it 0. GAME_ACTIVE is the master gate — both interrupt bodies load it first and, finding it
 *   zero, fall straight to their epilogue without touching the play field. The flag is raised where a
 *   game or round begins (enterRoundWithFieldReload/enterRoundWithoutFieldReload, returnToAttractFlow)
 *   and dropped on death, reset, and handoff.
 *
 * ROM 0x19d3.  Grounding: [seen] (GAME_ACTIVE is [seen]).
 *
 * LIVE-OUT: memory only (GAME_ACTIVE := A); the seam completes the ret.
 */
export function storeGameActive(m, a = m.regs.a) {
  // Store the accumulator into the game-active flag cell (0x20e9).
  m.mem8[GAME_ACTIVE] = a;
}
