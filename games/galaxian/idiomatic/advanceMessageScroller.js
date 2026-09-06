// SPDX-License-Identifier: GPL-3.0-only
// Message-scroller step. While enabled: if the delay counter's low bits are still set, just tick it;
// at a terminator char, tick and finish; else emit one glyph up the column, advance the source
// pointer, and tick the counter (which stops the scroller on the zero-crossing).
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

  // Scroller idle.
  if ((mem8[MESSAGE_SCROLL_ENABLE] & 1) === 0) return;

  const counterPtr = mem16[MESSAGE_CURSOR_PTR];

  // Still delaying: just tick the counter.
  if ((mem8[counterPtr] & 0x07) !== 0) return endMessageScrollOnExpiry(m, counterPtr);

  const textPtr = mem16[MESSAGE_TEXT_PTR];
  const char = mem8[textPtr];

  // Terminator: emit nothing, just finish the countdown.
  if (char === TEXT_END) return endMessageScrollOnExpiryFromDe(m, counterPtr);

  // Emit one glyph: advance the source, char->tile into the dest cell, step the dest up one
  // column, then tick the counter.
  mem16[MESSAGE_TEXT_PTR] = u16(textPtr + 1);
  const dest = mem16[MESSAGE_DEST_PTR];
  mem8[dest] = char - GLYPH_BASE;
  mem16[MESSAGE_DEST_PTR] = u16(dest - COLUMN_UP);
  return endMessageScrollOnExpiryFromDe(m, counterPtr);
}
