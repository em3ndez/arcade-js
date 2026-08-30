// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blit2x2TileBlock — stamp a 2x2 square of character tiles into video RAM.
 *
 * ROM 0x3325-0x3336. Grounding: [seen].
 *
 * WHAT IT IS: the graphics primitive that draws a two-by-two block of characters. Video RAM
 * is a grid of 8x8 character cells; horizontally adjacent cells are one byte apart, and the
 * cell directly below is one row-pitch (0x20 bytes) further on. Given a four-byte source
 * block and a destination anchor (the top-left cell of the square), it copies the four bytes
 * into the four cells of the square.
 *
 * WRITE ORDER: top-left (dest+0x00), top-right (dest+0x01), bottom-right (dest+0x21 =
 * one row down and one across), bottom-left (dest+0x20 = one row down). The source bytes are
 * consumed consecutively — src+0..src+3 — in that same order, so byte 0 is the top-left tile,
 * byte 1 the top-right, byte 2 the bottom-right, byte 3 the bottom-left. The block is walked
 * clockwise from the top-left corner.
 *
 * ROLE IN THE MACHINE: the drawing step for anything built out of 2x2 character blocks — the
 * rope-segment tiles and launch/flip animations feed it their four-byte source blocks (e.g.
 * ROPE_SEGMENT_TILE_SRC / _ALT) to paint one segment at a time.
 *
 * A PURE LEAF: it calls nothing, and its only lasting effect is the four video-RAM cells.
 *
 * LIVE-OUT: the destination pointer advanced one row down, to the bottom-left cell
 * (dest + 0x20, taken 16-bit), returned. The two-tile animators read it to step one row up
 * before the next blit, so wiring must write it back. The four VRAM cells are the memory
 * effect. The source pointer and scratch register are left as they fell — callers restore or
 * ignore them.
 */
export function blit2x2TileBlock(m, dest = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  // Copy the four source bytes into the four cells of the square, walking clockwise from the
  // top-left. 0x01 is one cell across; 0x20 is the video-RAM row pitch, so +0x21 is the cell
  // diagonally down-right and +0x20 the cell directly below the anchor.
  mem8[dest + 0x00] = mem8[src + 0x00]; // top-left
  mem8[dest + 0x01] = mem8[src + 0x01]; // top-right (one cell across)
  mem8[dest + 0x21] = mem8[src + 0x02]; // bottom-right (one row down, one across)
  mem8[dest + 0x20] = mem8[src + 0x03]; // bottom-left (one row down)

  // Return the anchor advanced by one row pitch — the bottom-left cell just written. The
  // rope/flip animators use this to walk up column by column across successive blits.
  return (m.regs.hl = u16(dest + 0x20)); // HL live-out: sets HL for the animators, returns it
}
