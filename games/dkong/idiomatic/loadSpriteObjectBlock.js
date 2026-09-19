// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadSpriteObjectBlock — copy the 40-byte sprite-object block from the caller's HL source
 * pointer into SPRITE_OBJ_BLOCK. Forward byte-by-byte copy, so it stays faithful even when
 * source and destination overlap.
 *
 * LIVE-OUT: memory (the 40 bytes at SPRITE_OBJ_BLOCK) + HL/DE/BC in the block-move's terminal
 * state (HL = source + 40, DE = one past the destination, BC = 0). Flags and A untouched.
 */

import { u16 } from "../../../core/int.js";
import { SPRITE_OBJ_BLOCK } from "./names.js";

const OBJ_BLOCK_BYTES = 0x28; // 10 sprite records x 4 bytes

export function loadSpriteObjectBlock(m, hl = m.regs.hl) {
  const { mem8 } = m;

  let src = hl;
  let dst = SPRITE_OBJ_BLOCK;
  for (let i = 0; i < OBJ_BLOCK_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = u16(src + 1);
    dst = u16(dst + 1);
  }

  // Block-move terminal live-outs, read back by register-dispatched frozen callers.
  return (m.regs.hl = src, m.regs.de = dst, m.regs.bc = 0);
}
