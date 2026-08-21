// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_ANIM_PARITY, TILE_ANIM_CURSOR } from "./names.js";
/**
 * retreatTileAnimScript — the even-frame half of the tile-animation cursor pair. Bumps the parity gate
 * and runs only on even frames (bit0 clear). On an even frame it walks the cursor's target byte back:
 * a 0x34 marker reloads to 0x10 and steps the pointer back one (past the high byte); any other value is
 * decremented in place. The (possibly stepped-back) pointer is stored to the cursor.
 *
 * LIVE-OUT: memory only — the parity gate, the tile byte at the cursor, and the cursor word. No register
 * or flag survives for the caller.
 */
export function retreatTileAnimScript(m) {
  const { mem8, mem16 } = m;

  mem8[TILE_ANIM_PARITY] = mem8[TILE_ANIM_PARITY] + 1;
  if (mem8[TILE_ANIM_PARITY] & 0x01) return; // odd frame -> the advance half runs, not this one

  let ptr = mem16[TILE_ANIM_CURSOR];
  if (mem8[ptr] === 0x34) {
    mem8[ptr] = 0x10;   // rewind marker -> reload the base tile code
    ptr = u16(ptr - 1); // back the pointer up one cell (past the high byte)
  } else {
    mem8[ptr] = mem8[ptr] - 1; // step the tile code back one
  }
  mem16[TILE_ANIM_CURSOR] = ptr;
}
