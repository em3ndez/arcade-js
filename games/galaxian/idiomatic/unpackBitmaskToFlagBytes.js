// SPDX-License-Identifier: GPL-3.0-only
/**
 * unpackBitmaskToFlagBytes (ROM 0x0646) -- expand a packed board bitmap into the formation flag grid.
 *
 * WHAT IT IS
 *   The standing formation of aliens is stored two ways. In RAM the game keeps it as FLAG_BITS_BASE
 *   (0x4100): a block of 128 one-byte-per-cell flags, one byte per formation cell, that the rest of the
 *   engine indexes cheaply (0 = empty, 1 = live alien). On disk / between turns a board is held compactly
 *   as a 16-byte packed bitmap (16 bytes x 8 bits = 128 bits). This routine is the expander that turns
 *   the compact 16-byte mask at (DE) into the 128 loose flag bytes; packFlagBytesToBitmask (0x0764) is
 *   its exact inverse.
 *
 * ROLE IN THE MACHINE
 *   Called at board/level start (e.g. from restoreFormationAndEnterPlaySubstate, 0x05a5) with DE
 *   pointing at a packed mask. It walks the 16 mask bytes LSB-first, writing one flag byte per bit into
 *   FLAG_BITS_BASE upward, and leaves DE advanced past the 16 mask bytes -- so the caller can read DE
 *   back and keep copying the board data that follows the mask in one chained block copy.
 *
 * Grounding: [seen] (names.js cert for 0x0646; formation bitmap described in mechanisms.md "The
 * object / formation field").
 *
 * LIVE-OUT: 128 bytes at FLAG_BITS_BASE (0x4100) written; m.regs.de advanced by 16 (returned).
 */
import { u16 } from "../../../core/int.js";
import { FLAG_BITS_BASE } from "./names.js";

export function unpackBitmaskToFlagBytes(m, src = m.regs.de) {
  const { mem8 } = m;

  // Destination cursor: the flag grid fills from its base (0x4100) upward, one byte per bit.
  let out = FLAG_BITS_BASE;
  // 16 mask bytes -> 16 rows of 8 flags = the full 128-cell formation grid.
  for (let row = 0; row < 16; row++) {
    // Read one packed byte; its 8 bits become 8 consecutive flag bytes.
    const packed = mem8[src];
    // LSB-first: bit 0 of the byte lands in the lowest of these 8 flag cells, bit 7 in the highest --
    // matching packFlagBytesToBitmask's inverse ordering so a pack/unpack round-trips exactly.
    for (let bit = 0; bit < 8; bit++) {
      // Isolate this bit and store it as a whole byte (1 for a live cell, 0 for empty), then bump out.
      mem8[out++] = (packed >> bit) & 1;
    }
    // Advance the source pointer one mask byte (16-bit wrap to stay in the Z80 address space).
    src = u16(src + 1);
  }

  // Publish the advanced source pointer back into DE so a chained copy resumes just past the 16-byte mask.
  return (m.regs.de = src);
}
