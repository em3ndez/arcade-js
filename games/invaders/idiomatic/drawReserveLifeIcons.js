// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { clearScreenRegion } from "./clearScreenRegion.js";
import { RESERVE_SHIP_ICONS_SCREEN_ADDR, RESERVE_SHIP_SPRITE } from "./names.js";

/**
 * drawReserveLifeIcons — paint the row of reserve-ship icons, then wipe the leftover strip.
 *
 * WHAT IT IS
 *   The graphical half of the lives readout. Given a reserve-ship count in A (with the zero condition
 *   flagged in Z), it lays down that many little ship icons in a left-to-right row and then blanks the
 *   rest of the row so icons from a previously higher life count are erased. When the count is zero it
 *   draws nothing and goes straight to the wipe.
 *
 * ROLE IN THE MACHINE
 *   Called by decrementShipsAndDrawReadout, which fetches the active player's reserve count, bails if it
 *   is zero, and passes count-1 (the ships held back beyond the one currently in play) plus the
 *   count==0 Z flag. Each icon is a 16-byte blit of RESERVE_SHIP_SPRITE (0x1c60) through drawSpriteColumn
 *   (0x10 bytes at a 0x20 stride, so the destination walks one column right per byte — a 16-byte icon spans 16 columns, one icon slot); the tail
 *   clearScreenRegion blanks the strips beyond the icons down to the terminator row. Writes video RAM at
 *   RESERVE_SHIP_ICONS_SCREEN_ADDR (0x2701) and below.
 *
 * ROM 0x19e6.  Grounding: [seen].
 *
 * LIVE-OUT: whatever clearScreenRegion leaves (HL/A/B), since both exits tail into it.
 */
export function drawReserveLifeIcons(m, a = m.regs.a, z = m.regs.fZ) {
  // Seat the icon-strip base: the fixed screen address where the reserve-ship row begins.
  let hl = RESERVE_SHIP_ICONS_SCREEN_ADDR;
  // Count-zero shortcut: with no reserve ships to draw, skip straight to blanking the whole strip so any
  // previously drawn icons are cleared.
  if (z) return clearScreenRegion(m, hl);
  // Draw `a` icons. Each pass blits one RESERVE_SHIP_SPRITE column (0x10 bytes) and advances HL to the
  // next icon slot; the counter walks down and the loop repeats until it drains to zero.
  let counter = a;
  do {
    hl = drawSpriteColumn(m, hl, RESERVE_SHIP_SPRITE, 0x10);
    counter = u8(counter - 1);
  } while (counter !== 0);
  // Blank everything past the last icon drawn, down to the terminator row, so stale icons disappear.
  return clearScreenRegion(m, hl);
}
