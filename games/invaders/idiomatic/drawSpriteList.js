// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";

/**
 * drawSpriteList (ROM 0x08f3) -- render a run of consecutive sprite ids as a line of glyphs.
 *
 * WHAT IT IS
 *   Walks C sprite ids stored consecutively in memory from DE, drawing each through drawSprite8x8. Because
 *   drawSprite8x8 returns HL advanced one 8x8 glyph-cell down the screen, letting that returned pointer
 *   carry into the next draw strings the ids into a single line (columns run vertically down the rotated
 *   display, so a "line" of text is laid out this way).
 *
 * ROLE IN THE MACHINE
 *   The driver behind all the game's fixed text: drawScoreHeader (the top header), drawCreditLabel (the
 *   CREDIT label), drawTaitoCopyright (the copyright line), and the round/game-over banners all seat a
 *   source id table in DE, a glyph count in C, and a screen address in HL, then hand off here.
 *   drawThreeSprites is the same driver with C pinned to 3.
 *
 * ROM 0x08f3.  Grounding: [seen] (names.js cert for 0x08f3).
 *
 * LIVE-OUT: HL (past the last glyph drawn), DE (past the last id consumed), C (drained to 0).
 */
// Blit a run of sprites whose ids sit consecutively in memory, walking the screen pointer down per id.
export function drawSpriteList(m, de = m.regs.de, c = m.regs.c, hl = m.regs.hl) {
  // Local cursors for the id source (ptr), the remaining count, and the running screen destination (dst).
  let ptr = de;
  let count = c;
  let dst = hl;
  // Draw one glyph per id: plot mem[ptr], step to the next id, decrement the count. This is a do/while --
  // the 8080 `dcr c / jnz` tests AFTER the first draw, so a count of 0 wraps to a full 256-glyph pass.
  do {
    dst = drawSprite8x8(m, m.mem8[ptr], dst);
    ptr = u16(ptr + 1);
    count = u8(count - 1);
  } while (count !== 0);
  // Publish the advanced pointers back to the registers so a chained caller continues where this left off.
  return [(m.regs.hl = dst), (m.regs.de = ptr), (m.regs.c = count)];
}
