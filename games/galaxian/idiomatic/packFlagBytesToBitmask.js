// SPDX-License-Identifier: GPL-3.0-only
// packFlagBytesToBitmask -- ROM 0x0764, grounding [seen].
// Compresses the standing formation back into its packed form. The live
// formation is stored one-byte-per-alien as 128 flag bytes at FLAG_BITS_BASE
// (0x4100); this reads bit0 of each and packs them LSB-first into a 16-byte
// bitmap at the destination pointer (128 bits = 16 bytes). It is the exact
// inverse of unpackBitmaskToFlagBytes (ROM 0x0646). The packed 16-byte form is
// how a board is stored between turns -- PACKED_FLAG_BITMAP (0x4180) and
// SAVED_STATE_SNAPSHOT (0x41a0) hold the two players' boards.
// The destination defaults to register pair DE (the Z80 entry convention).
// Live-out: 16 bytes written at dst, and DE advanced +16 past them so the caller
// can chain a block copy immediately after the bitmap.
import { u16 } from "../../../core/int.js";
import { FLAG_BITS_BASE } from "./names.js";

export function packFlagBytesToBitmask(m, dst = m.regs.de) {
  const { mem8 } = m;

  // Walk the 128 source flag bytes eight at a time, emitting one packed byte per
  // group of eight into the 16-byte destination bitmap.
  let src = FLAG_BITS_BASE;
  for (let byte = 0; byte < 16; byte++) {
    // Build one output byte from the next eight flags, LSB first: the Nth flag's
    // bit0 becomes output bit N.
    let packed = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (mem8[src] & 0x01) packed |= 1 << bit;
      src++;
    }
    mem8[dst + byte] = packed;
  }

  // Return DE advanced past the 16 written bytes (u16-wrapped) so the caller can
  // chain the template/board copy that follows the packed bitmap.
  return (m.regs.de = u16(dst + 16));
}
