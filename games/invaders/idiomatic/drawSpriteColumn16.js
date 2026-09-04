// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteColumn } from "./drawSpriteColumn.js";

/**
 * drawSpriteColumn16 — draw a byte-aligned sprite column of a fixed 16 rows.
 *
 * WHAT IT IS
 *   Copies a 16-byte, byte-aligned graphic straight down a video-RAM column. Video memory is walked
 *   one screen row at a time by adding 0x20 to the destination pointer, so a "column" is a vertical
 *   strip on the rotated display. This entry forces the row count to 0x10 (16) and hands off to the
 *   general column blitter, so the caller need not load a length. Byte-aligned (no hardware shift), so
 *   it lands only on eight-pixel boundaries.
 *
 * ROLE IN THE MACHINE
 *   A fixed-height front door over drawSpriteColumn (0x1439), which copies B source bytes (from DE)
 *   into B adjacent screen rows (from HL), stride 0x20 per byte, and returns HL advanced by 0x20*B.
 *   Passing 0x10 as B here means BC is not consumed as the caller's count — hence "preserving BC".
 *   HL = destination screen address, DE = source graphic.
 *
 * ROM 0x1844.  Grounding: [seen].
 *
 * LIVE-OUT: HL = HL + 0x20*0x10 (the destination advanced past the 16 rows); video RAM written.
 */
export function drawSpriteColumn16(m, hl = m.regs.hl, de = m.regs.de) {
  // Delegate to the general column blitter with a fixed 16-row count; return its advanced HL.
  return drawSpriteColumn(m, hl, de, 0x10);
}
