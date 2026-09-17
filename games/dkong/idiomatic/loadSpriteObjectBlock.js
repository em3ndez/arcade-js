// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadSpriteObjectBlock — copy the 40-byte sprite-object block from the caller's HL source
 * pointer into SPRITE_OBJ_BLOCK. Forward byte-by-byte copy, so it stays faithful even when
 * source and destination overlap.
 *
 * LIVE-OUT: memory (the 40 bytes at SPRITE_OBJ_BLOCK) + HL/DE/BC in the block-move's terminal
 * state (HL = source + 40, DE = one past the destination, BC = 0). Flags and A untouched.
 */

import { SPRITE_OBJ_BLOCK } from "./names.js";

const OBJ_BLOCK_BYTES = 0x28; // 10 sprite records x 4 bytes

export function loadSpriteObjectBlock(m, hl = m.regs.hl) {
  const { regs, mem8 } = m;

  let src = hl;
  let dst = SPRITE_OBJ_BLOCK;
  for (let i = 0; i < OBJ_BLOCK_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  regs.hl = src;
  regs.de = dst;
  regs.bc = 0;
}
