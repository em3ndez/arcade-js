// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SPRITE_BITMAP_TABLE } from "./names.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";

/**
 * drawSprite8x8 — plot one 8x8 glyph identified by a sprite id.
 *
 * WHAT IT IS
 *   The glyph plotter that underlies all of Space Invaders' fixed text and digits. Given a sprite id in
 *   A, it resolves that id to its eight source bytes, kicks the hardware watchdog (output port 0x06), and blits
 *   an 8-row (byte-aligned) column into video RAM at HL.
 *
 * ROLE IN THE MACHINE
 *   Sprite bitmaps sit in an 8-byte-per-entry table based at SPRITE_BITMAP_TABLE (0x1e00), so id A's source is at
 *   SPRITE_BITMAP_TABLE + 8*A. Writing A to output port 0x06 kicks the mw8080bw watchdog (any write resets it); A
 *   lands there only because it still holds the sprite id — port 0x06 is not a shifter control (the
 *   shifter's alignment offset goes to port 0x02, via seatBlitPosition). The actual pixels go down
 *   through drawSpriteColumn (0x1439) as one byte wide by eight rows
 *   (stride 0x20 per row), and that routine leaves HL advanced 0x20*8 down the screen — one glyph cell —
 *   which is what lets drawSpriteList / drawThreeSprites string glyphs into a line by re-calling this per
 *   id. Callers include the text/label draws and drawDigit (0x09c5).
 *
 * ROM 0x08ff-0x0912.  Grounding: [seen].
 *
 * LIVE-OUT: HL (advanced one glyph cell down the screen by the drawSpriteColumn tail).
 */
export function drawSprite8x8(m, a = m.regs.a, hl = m.regs.hl) {
  // Resolve sprite id A to its 8-byte source: the glyph table is 8 bytes per entry based at SPRITE_BITMAP_TABLE.
  const src = u16(SPRITE_BITMAP_TABLE + 8 * a);

  // Kick the hardware watchdog on output port 0x06 (any write resets it; the value written, the sprite id still in A, is immaterial).
  m.io.portOut(0x06, a);

  // Blit the 8 source bytes as an 8-row column into video RAM at HL.
  return drawSpriteColumn(m, hl, src, 8);
}
