// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, loc_20e7 } from "./names.js";

/**
 * activePlayerFlagPtr — resolve the current player's slot in a two-byte flag pair.
 *
 * WHAT IT IS
 *   Returns the address of one of two adjacent work-RAM cells (loc_20e7 and loc_20e7+1),
 *   choosing between them by which player is currently on the machine. It only computes and
 *   returns a pointer; it does not read or write the cell itself.
 *
 * ROLE IN THE MACHINE
 *   Space Invaders keeps most current-player state on a whole RAM page selected by the low bit
 *   of ACTIVE_PLAYER_PAGE (0x2067): bit0 set = player 1, bit0 clear = player 2 (see mechanisms.md
 *   "Locating the active player's data"). A handful of scalar per-player flags do not live on the
 *   page but as adjacent pairs in the shared work area; loc_20e7/loc_20e7+1 is one such pair, one
 *   byte per player. This helper turns the player-select bit into the right byte of that pair so a
 *   caller can read or set the flag for whoever is playing. The exact meaning of the flag stored
 *   there is not yet pinned down, so loc_20e7 keeps its placeholder name.
 *
 * ROM 0x1910.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the selected cell address (loc_20e7 for player 1, loc_20e7+1 for player 2). Also
 * returned as the function value.
 */
export function activePlayerFlagPtr(m) {
  // Test bit0 of ACTIVE_PLAYER_PAGE (0x2067) — the player selector. When set (player 1) address the
  // first cell of the pair (loc_20e7); when clear (player 2) address the second (loc_20e7+1). The
  // result is parked in HL, matching the Z80 routine that hands its pointer back in HL.
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? loc_20e7 : loc_20e7 + 1);
}
