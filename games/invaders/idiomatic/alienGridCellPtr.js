// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * alienGridCellPtr — map a (row, column) grid position to the alien's liveness byte.
 *
 * WHAT IT IS
 *   A pure address calculator. The active player's aliens live as a 55-cell (5 rows x 11 columns)
 *   liveness grid at the bottom of that player's 256-byte work-RAM page: one byte per alien, nonzero
 *   while it is still on the board. Given a row/block index and a column offset this returns the
 *   pointer to that cell, so a caller can test or clear one specific alien.
 *
 * ROLE IN THE MACHINE
 *   Called by resolvePlayerShotHit (the state-2 shot resolver): after a player shot is scaled to a
 *   coarse grid block (scaleXToBlock / scaleYToBlock), this routine turns that block index into the
 *   record address, which the caller then tests for a live alien, clears on a kill, and feeds to the
 *   explosion/scoring tail. The high byte comes from ACTIVE_PLAYER_PAGE (0x2067) so the same code
 *   addresses whichever player's field (0x21xx or 0x22xx) is currently in play.
 *
 * ROM 0x1581-0x158f.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the computed cell pointer (also returned).
 */
export function alienGridCellPtr(m, index = m.regs.b, offset = m.regs.c) {
  // Step 1 — row stride. The 8080 rotates the index left three times (RLC x3), which is a multiply
  // by 8 modulo 256; adding the index three more times (the ROM's three `add b`s) makes 11*index.
  // Eleven is the grid width, so this is the base offset of the alien row selected by `index`.
  const rot = ((index << 3) | (index >> 5)) & 0xff;
  // Step 2 — column and 1-based bias. Add the column offset and subtract one (the ROM's `dcr a`),
  // giving the low byte low = (11*index + offset - 1) & 0xff, i.e. the byte position of this one
  // alien within the 55-cell grid.
  const low = (rot + 3 * index + offset - 1) & 0xff;
  // Step 3 — page the pointer. The high byte is the active player's page number (ACTIVE_PLAYER_PAGE
  // shifted left 8), so HL lands inside 0x21xx (player 1) or 0x22xx (player 2) — the live grid.
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | low);
}
