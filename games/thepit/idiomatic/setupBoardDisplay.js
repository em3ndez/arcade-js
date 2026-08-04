// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupBoardDisplay — record the board-mode byte and rebuild the whole screen for it.  ROM 0x4b46.
 *
 * The shared body of the three display-setup doors. Each door picks a different
 * board-mode byte — the 0xC0 / 0x90 / 0x00 variants, and the 0xA0 / 0xE0 the round
 * setup and player teardown hand in — and drops into here. This routine records
 * that byte and rebuilds the entire screen from scratch for it:
 *   - clears every hardware sprite and un-scrolls every column (a clean slate);
 *   - wipes the whole tilemap to the background tile;
 *   - floods the colour RAM so the whole field takes one flat colour; and
 *   - blanks the sprite-staging block.
 * The byte does double duty: it is stored where later code reads it as the board-mode
 * selector, and in this same pass the colour fill picks it up as the screen-wide
 * colour. The setup that follows draws the new screen's contents on top of this
 * blank field.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b46.test.js.
 * GATE:     real dispatch (fires during cold boot, where the 0xC0 door hands the
 *           byte in) + a crafted sweep over every board-mode byte 0..255 (each byte's
 *           screen rebuild is identical to the oracle). The RAM diff excludes the dead
 *           2-byte stack-scratch window the oracle's setup calls park just below the
 *           entry stack pointer. Teeth: a twin that records the wrong board-mode byte
 *           is caught at BOARD_MODE (and the colour it floods); a twin that skips the
 *           tilemap wipe is caught in video RAM.
 * LIVE-OUT: memory-only — BOARD_MODE plus every cell the four setup passes write
 *           (sprite/attribute RAM, the tilemap, the colour RAM, the sprite-staging
 *           block). No register or flag is live out: the callers return straight
 *           through this routine's tail.
 * NAMES:    BOARD_MODE (0x8057) from names.js — the byte recorded here and reused as the
 *           screen-wide fill colour. The four setup helpers name their own regions.
 */
import { BOARD_MODE } from "./names.js";
import { clearSpriteAndAttributeRam } from "./clearSpriteAndAttributeRam.js";
import { fillVideoRam } from "./fillVideoRam.js";
import { fillColorRam } from "./fillColorRam.js";
import { clearSpriteStagingBuffer } from "./clearSpriteStagingBuffer.js";

export function setupBoardDisplay(m, boardMode = m.regs.a) {
  const { mem8 } = m;

  // Record the board-mode byte where later code reads it as the mode selector, and
  // where the colour fill below picks it up as the screen-wide colour.
  mem8[BOARD_MODE] = boardMode;

  // Rebuild the whole screen for this board: clear every sprite and un-scroll each
  // column, wipe the tilemap to the background tile, flood the colour RAM with this
  // board's colour, then blank the sprite-staging block.
  clearSpriteAndAttributeRam(m);
  fillVideoRam(m);
  fillColorRam(m);
  clearSpriteStagingBuffer(m);
}
