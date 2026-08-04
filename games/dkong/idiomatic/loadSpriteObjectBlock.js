// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadSpriteObjectBlock — copy the 40-byte sprite-object block from the caller's
 * source pointer into 0x6908.  ROM 0x004e.
 *
 * A fixed-destination block copy. sub_004e hard-wires the DESTINATION (0x6908 =
 * SPRITE_OBJ_BLOCK, the 10-record / 40-byte sprite-object group that lives inside
 * the sprite shadow buffer) and the LENGTH (0x28 = 40 = 10 records x 4 bytes), but
 * NOT the source: it sets DE and BC and does an `ldir` without touching HL, so HL is
 * an implicit input supplied by each of its thirteen callers. The routine therefore
 * loads the block from wherever the caller points — a scene-dependent ROM template of
 * sprite records (board decor, cutscene props); the STRUCTURE it fills is fixed even
 * though the CONTENT is not.
 *
 * The copy is a forward byte-by-byte `ldir`, so it is faithful even when source and
 * destination overlap (a forward memmove, not memcpy). After it, the routine leaves
 * the LDIR's terminal register state: HL advanced past the source, DE past the
 * destination, BC drained to zero.
 *
 * Memory-equivalent to the frozen oracle — equivalence-004e.test.js.
 * GATE:     crafted-entry; reached in attract (48 real dispatches / 2000 frames, 5
 *           ROM-template sources) + crafted HL/source-pattern entries (incl. an
 *           overlap case) poked identically on both sides. Teeth = off-by-one length.
 * LIVE-OUT: memory (the 40 bytes at SPRITE_OBJ_BLOCK) + HL/DE/BC, set to the LDIR
 *           terminal state (HL = source+0x28, DE = 0x6930, BC = 0) so any of the 13
 *           callers that consumes a register is safe. Flags and A are untouched by
 *           BOTH sides (the oracle's ldirAt models no flags), so they match trivially;
 *           SP/PC are not compared — the idiomatic layer drops the `ret`'s stack/PC
 *           bookkeeping (the JS call stack replaces it).
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908).
 */

import { SPRITE_OBJ_BLOCK } from "./names.js";

const OBJ_BLOCK_BYTES = 0x28; // 10 sprite records x 4 bytes

export function loadSpriteObjectBlock(m) {
  const { regs, mem } = m;

  let src = regs.hl; // caller-supplied source (HL is an implicit input)
  let dst = SPRITE_OBJ_BLOCK; // 0x6908, the fixed destination
  for (let i = 0; i < OBJ_BLOCK_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // LDIR's terminal register state, reproduced so any caller that reads it is safe.
  regs.hl = src; // HL_in + 0x28
  regs.de = dst; // 0x6930
  regs.bc = 0; // drained
}
