// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { drawReserveLifeIcons } from "./drawReserveLifeIcons.js";
import { drawLivesDigit } from "./drawLivesDigit.js";

/**
 * decrementShipsAndDrawReadout -- take one ship into play and repaint the bottom-line lives readout.
 *
 * WHAT IT IS
 *   The active player's remaining-ship count is stored at the very top of that player's work-RAM page
 *   ((page<<8)|0xff). This routine consumes one ship (the one about to enter play), writes the reduced
 *   count back, and redraws the two halves of the on-screen lives readout: the row of reserve-ship icons
 *   (the ships held back, i.e. count-1) and the single lives digit (the full count).
 *
 * ROLE IN THE MACHINE
 *   Reads/writes the active player's ship count via readActivePlayerPageTopByte (which forms
 *   (mem[ACTIVE_PLAYER_PAGE]<<8)|0xff and returns that address in HL and the byte in A). Repaints through
 *   drawReserveLifeIcons (RESERVE_SHIP_ICONS_SCREEN_ADDR) and drawLivesDigit (LIVES_DIGIT_SCREEN_ADDR).
 *   It is the ships-readout entry reached at round setup and (as doJFlow's loc_1a7f re-entry) on an
 *   extra-life continuation, where one reserve ship is spent before re-entering the round.
 *
 * ROM 0x1a7f.  Grounding: [seen].
 *
 * LIVE-OUT: falls through to drawLivesDigit's result; memory + video RAM. A no-op (early return) when the
 * player has no ships left.
 */
export function decrementShipsAndDrawReadout(m) {
  // Fetch the active player's ship count from the top of its page (HL = that address, a = the count).
  const [hl, a] = readActivePlayerPageTopByte(m);
  // No ships left: nothing to spend and nothing to redraw.
  if (a === 0) return;
  // Spend one ship (the one entering play) and store the reduced count back into the page-top cell.
  const reserve = u8(a - 1);
  m.mem8[hl] = reserve;
  // Paint the reserve-ship icon row for the ships held BACK (count-1). The third argument is the 8080
  // Z-flag condition: when the reserve is zero, drawReserveLifeIcons skips drawing and just clears the
  // strip so leftover icons from a higher life count are wiped.
  drawReserveLifeIcons(m, reserve, reserve === 0);
  // Plot the numeric lives digit using the FULL count (a), so the digit and the reserve icons together
  // read as one coherent readout (ship in play + ships in reserve).
  return drawLivesDigit(m, a);
}
