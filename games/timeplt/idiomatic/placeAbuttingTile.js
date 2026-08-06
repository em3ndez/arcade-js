// SPDX-License-Identifier: GPL-3.0-only
/** placeAbuttingTile — carry an object onto one more sprite entry, flush against the one it already
 * occupies. The current entry's two coordinate bytes are read; the entry one stride on takes one
 * of them advanced by a sprite's pitch, truncated to a byte, and the other copied unchanged.
 * Both cursors then step onto the entry just written, so a caller can chain a further one.
 * LIVE-OUT: the two bytes written, and the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";

const ENTRY_STRIDE = 2;
const SPRITE_PITCH = 16;
const STEPPED_COORDINATE = 49;
const COPIED_COORDINATE = 0;

export function placeAbuttingTile(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  const nextEntry = entry + ENTRY_STRIDE;

  mem8[nextEntry + STEPPED_COORDINATE] = mem8[entry + STEPPED_COORDINATE] + SPRITE_PITCH;
  mem8[nextEntry + COPIED_COORDINATE] = mem8[entry + COPIED_COORDINATE];
  advanceToNextSlot(m);
}
