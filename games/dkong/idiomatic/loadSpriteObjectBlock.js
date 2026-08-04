// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadSpriteObjectBlock — copy the 40-byte sprite-object block from the caller's source
 * pointer into SPRITE_OBJ_BLOCK.
 *
 * A fixed-destination block copy. The DESTINATION (SPRITE_OBJ_BLOCK, the 10-record /
 * 40-byte sprite-object group inside the sprite shadow buffer) and the LENGTH (40 = 10
 * records x 4 bytes) are hard-wired; the SOURCE is not. The source pointer arrives in HL as
 * an implicit input, so the routine loads the block from wherever the caller points — a
 * scene-dependent template of sprite records (board decor, cutscene props). The STRUCTURE it
 * fills is fixed even though the CONTENT is not.
 *
 * The copy is forward and byte-by-byte, so it stays faithful even when source and destination
 * overlap: a forward memmove, not a memcpy. Afterwards it leaves the block-move's terminal
 * register state — HL advanced past the source, DE past the destination, BC drained to zero.
 *
 * LIVE-OUT: memory (the 40 bytes at SPRITE_OBJ_BLOCK) + HL/DE/BC in that terminal state
 * (HL = source + 40, DE = one past the destination, BC = 0), so any caller that consumes a
 * register is safe. Flags and A are untouched.
 */

import { SPRITE_OBJ_BLOCK } from "./names.js";

const OBJ_BLOCK_BYTES = 0x28; // 10 sprite records x 4 bytes

export function loadSpriteObjectBlock(m) {
  const { regs, mem } = m;

  let src = regs.hl; // caller-supplied source (HL is an implicit input)
  let dst = SPRITE_OBJ_BLOCK; // the fixed destination
  for (let i = 0; i < OBJ_BLOCK_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // The block move's terminal register state, so any caller that reads it is safe.
  regs.hl = src; // source + 40
  regs.de = dst; // one past the destination
  regs.bc = 0; // drained
}
