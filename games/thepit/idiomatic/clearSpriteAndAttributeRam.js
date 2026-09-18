import { ATTR_SCROLL_RAM_BASE } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteAndAttributeRam — wipe the sprites and per-column scroll for a clean screen.
 *
 * The first of the screen/board setup sequence's three fill/clear steps. It zeroes the low
 * 128 bytes of the display block: the attribute / column-scroll RAM (one byte per column,
 * so zeroing un-scrolls every column), the eight four-byte sprite slots (clearing every
 * sprite off the screen), and the spare bytes above. The upper half is left untouched, and
 * base and length are fixed, so it always zeroes the same 128 bytes.
 */
export function clearSpriteAndAttributeRam(m) {
  const { mem8 } = m;

  // Zero the low half of the display block: column-scroll RAM, sprite slots, and spare.
  for (let i = 0; i < 128; i++) mem8[ATTR_SCROLL_RAM_BASE + i] = 0;

  return m.ret();
}
