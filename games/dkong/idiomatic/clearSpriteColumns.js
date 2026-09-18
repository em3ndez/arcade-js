// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteColumns — zero field +0 (the X byte) of four fixed groups of sprite records via
 * four back-to-back stride-4 clears inside the sprite shadow buffer, parking those sprites at
 * the left edge (28 records total). Runs as Mario's death animation is seeded and from the
 * board-advance interlude. The fourth call is a hardware TAIL JUMP (no pushed return); here the
 * four are plain JS calls and the single return is this function returning.
 * LIVE-OUT: memory-only — the zeroed bytes; both callers drop the registers/flags the clear leaves.
 */

import { clearStridedBytes } from "./clearStridedBytes.js";
import { SPRITE_BUFFER } from "./names.js";

export function clearSpriteColumns(m) {
  clearStridedBytes(m, SPRITE_BUFFER + 0x50, 0x02); // records 20-21
  clearStridedBytes(m, SPRITE_BUFFER + 0x80, 0x0a); // records 32-41
  clearStridedBytes(m, SPRITE_BUFFER + 0xb8, 0x0b); // records 46-56
  clearStridedBytes(m, SPRITE_BUFFER + 0x10c, 0x05); // records 67-71 (the tail jump)
}
