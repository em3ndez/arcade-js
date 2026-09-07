// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceMessageScroller (ROM 0x18c0) -- push the scrolling attract text one glyph up its VRAM
 * column, one step per frame.
 *
 * WHAT IT IS
 *   Galaxian's attract mode scrolls messages (the score table / "coin" text) vertically up a screen
 *   column. This routine is that effect's per-frame step. While the effect is enabled it either idles
 *   through a short inter-glyph delay, finishes at a message terminator, or emits exactly one glyph:
 *   it reads the next source character, converts it to a tile code, drops it into the destination VRAM
 *   cell, and moves the destination pointer up one screen row so successive glyphs stack upward.
 *
 * ROLE IN THE MACHINE
 *   Runs unconditionally every frame from the per-frame service (mechanisms.md, "coins, sound, and the
 *   scroller advance whether the machine is attracting, waiting, or playing"), gated internally on
 *   MESSAGE_SCROLL_ENABLE (0x40b0). The three 16-bit pointers it walks are MESSAGE_CURSOR_PTR (0x40b1,
 *   -> the delay-counter cell), MESSAGE_TEXT_PTR (0x40b3, -> the next source char), and
 *   MESSAGE_DEST_PTR (0x40b5, -> the target VRAM cell). Both finishing paths hand the counter cell to
 *   the end-of-step helpers, which tick the delay counter and stop the scroller on its zero-crossing.
 *
 * Grounding: [seen] (names.js cert for 0x18c0).
 *
 * LIVE-OUT: MESSAGE_TEXT_PTR advanced +1 and MESSAGE_DEST_PTR moved up one row (-32) on the emit path;
 *   the destination VRAM cell written with the glyph tile; the delay counter ticked by the tail helper.
 */
import { endMessageScrollOnExpiry } from "./endMessageScrollOnExpiry.js";
import { endMessageScrollOnExpiryFromDe } from "./endMessageScrollOnExpiryFromDe.js";
import { u16 } from "../../../core/int.js";
import {
  MESSAGE_SCROLL_ENABLE,
  MESSAGE_CURSOR_PTR,
  MESSAGE_TEXT_PTR,
  MESSAGE_DEST_PTR,
} from "./names.js";

const TEXT_END = 63;    // end-of-message marker
const GLYPH_BASE = 48;  // char code minus this maps to the tile code
const COLUMN_UP = 32;   // one screen row up

export function advanceMessageScroller(m) {
  const { mem8, mem16 } = m;

  // Gate: the scroller is idle unless MESSAGE_SCROLL_ENABLE bit 0 is set. Nothing to do this frame.
  if ((mem8[MESSAGE_SCROLL_ENABLE] & 1) === 0) return;

  // The cursor pointer names the delay-counter cell; every path below feeds this cell to a tail helper.
  const counterPtr = mem16[MESSAGE_CURSOR_PTR];

  // Still inside the inter-glyph delay (low 3 bits of the counter nonzero): emit no glyph, just tick
  // the delay counter and return via endMessageScrollOnExpiry.
  if ((mem8[counterPtr] & 0x07) !== 0) return endMessageScrollOnExpiry(m, counterPtr);

  // Delay elapsed: look at the next source character.
  const textPtr = mem16[MESSAGE_TEXT_PTR];
  const char = mem8[textPtr];

  // Terminator (char == 63): the message is done -- emit nothing, just run the countdown tail so the
  // scroller stops on its own zero-crossing.
  if (char === TEXT_END) return endMessageScrollOnExpiryFromDe(m, counterPtr);

  // Emit one glyph. Advance the source pointer past the consumed character ...
  mem16[MESSAGE_TEXT_PTR] = u16(textPtr + 1);
  // ... fetch the destination VRAM cell ...
  const dest = mem16[MESSAGE_DEST_PTR];
  // ... write the tile code (char - 48 maps the char set onto the tile ROM) ...
  mem8[dest] = char - GLYPH_BASE;
  // ... step the destination up one screen row (-32) so the next glyph stacks above this one ...
  mem16[MESSAGE_DEST_PTR] = u16(dest - COLUMN_UP);
  // ... and tick the delay counter through the shared tail (which also stops the scroller at zero).
  return endMessageScrollOnExpiryFromDe(m, counterPtr);
}
