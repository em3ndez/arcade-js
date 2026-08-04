// SPDX-License-Identifier: GPL-3.0-only
/**
 * redrawPlayerUpIndicator — blink the on-screen "player up" indicator column, every 16th frame.
 *
 * Called from the per-frame housekeeping. It only does work on a multiple-of-16 frame (the
 * frame counter's low nibble zero); on every other frame it returns at once. On the frames it
 * does run, it repaints one player-indicator column of the tilemap, three cells tall, stepping
 * one screen row back between cells.
 *
 * Bit 4 of the frame counter selects the blink phase, so the indicator toggles every 16 frames:
 *   - bit 4 CLEAR — paint the CURRENT player's column: the player-number tile (index + 1) at
 *     the base cell, then two fixed tiles, one row back each.
 *   - bit 4 SET — first blank the current player's column, three blank tiles. Then, ONLY in a
 *     two-player game, paint the OTHER player's column (the index XOR 1) with its glyphs the
 *     same way, so the idle player's marker is showing exactly while the active one is blanked.
 *     In a one-player game this phase blanks and stops, which is what makes a single marker
 *     blink rather than two markers alternate.
 *
 * The player index both picks the column base and supplies the glyph: the base cell takes the
 * index plus one, so player 1 gets tile 1 and player 2 tile 2.
 *
 * A guard sits immediately after the frame test — with no credited game in progress the whole
 * repaint is skipped, so nothing paints an indicator during attract.
 *
 * Nothing consumes a return value.
 *
 * LIVE-OUT: memory-only — three tile cells of video RAM, in one of the two indicator columns.
 */
import { FRAME, CURRENT_PLAYER, TWO_PLAYER_GAME } from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";
import { selectPlayerIndicatorColumnBase } from "./selectPlayerIndicatorColumnBase.js";

// Video-RAM step between the three stacked indicator cells: −32 columns, which is one
// screen row back in the 32-wide tilemap.
const ROW_BACK = 0xffe0;

export function redrawPlayerUpIndicator(m) {
  const { mem } = m;

  // Only repaint on a multiple-of-16 frame; skip all other frames.
  const frame = mem.read8(FRAME);
  if ((frame & 0x0f) !== 0) return;

  // No repaint while in attract — the guard is shut until a game is credited.
  if (!gameActiveGuard(m)) return;

  // The current player's column base + the glyph value for its number tile.
  let selector = mem.read8(CURRENT_PLAYER);
  let colBase = selectPlayerIndicatorColumnBase(selector);

  if ((frame & 0x10) !== 0) {
    // Blink OFF phase: blank the current player's three cells.
    let addr = colBase;
    mem.write8(addr, 0x10);
    addr = (addr + ROW_BACK) & 0xffff;
    mem.write8(addr, 0x10);
    addr = (addr + ROW_BACK) & 0xffff;
    mem.write8(addr, 0x10);

    // One-player game: nothing else to paint this phase.
    if (mem.read8(TWO_PLAYER_GAME) === 0) return;

    // Two-player: repaint the OTHER player's column with its glyphs below.
    selector = mem.read8(CURRENT_PLAYER) ^ 0x01;
    colBase = selectPlayerIndicatorColumnBase(selector);
  }

  // Paint the selected column's glyphs: the player-number tile (index + 1) at the
  // base cell, then two fixed tiles one row back each.
  let addr = colBase;
  mem.write8(addr, (selector + 1) & 0xff);
  addr = (addr + ROW_BACK) & 0xffff;
  mem.write8(addr, 0x25);
  addr = (addr + ROW_BACK) & 0xffff;
  mem.write8(addr, 0x20);
}
