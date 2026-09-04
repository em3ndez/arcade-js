// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, loc_20e7 } from "./names.js";

/**
 * otherPlayerFlagPtr — select one of a two-cell pair by the active player's low select bit.
 *
 * WHAT IT IS
 *   Returns HL = loc_20e7 + (bit0 of ACTIVE_PLAYER_PAGE). ACTIVE_PLAYER_PAGE (0x2067) doubles as the
 *   player selector in its low bit — set means player one (page 0x21xx), clear means player two (page
 *   0x22xx). So this hands back the base cell loc_20e7 (0x20e7) for player two and the next cell up
 *   (0x20e8) for player one: a per-player one-byte flag chosen off the same selector everything else
 *   in this subsystem consults.
 *
 * ROLE IN THE MACHINE
 *   A twin of activePlayerFlagPtr (0x1910), which computes loc_20e7 + (bit0 CLEAR ? 1 : 0) — i.e. the
 *   opposite mapping, hence the "other player" name. Both are thin address builders over the pair at
 *   0x20e7/0x20e8. loc_20e7 keeps a placeholder name (its role is not yet pinned).
 *   Reads only ACTIVE_PLAYER_PAGE (0x2067).
 *
 * ROM 0x18e7.  Grounding: [seen] (loc_20e7 role open).
 *
 * LIVE-OUT: HL = the selected cell's address (also the returned value). The seam completes the ret.
 */
export function otherPlayerFlagPtr(m) {
  // AND the page byte with 1 to isolate the player selector, then add it to the base cell address:
  // bit0 set (player 1) -> 0x20e8, bit0 clear (player 2) -> 0x20e7.
  return (m.regs.hl = loc_20e7 + (m.mem8[ACTIVE_PLAYER_PAGE] & 1));
}
