// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { TUBE_SHAPE_INDEX, SHAPE_INDEX_TABLE, POKEY1_RANDOM } from "./names.js";

/**
 * resolveShapeTableIndex -- reduce a raw byte into the tube's level/shape table index. ROM 0xc2e8.
 *
 * Role in the machine: the tube shape for the current level is chosen from a ROM table. Callers
 * (tube layout at 0xc235, outline drawer at 0xc4e1) hand in a byte that may be a real level id or an
 * out-of-range value; this routine normalizes it, maps its low nibble through the shape table, and
 * packs the result into the form the drawing code expects. It also caches the resolved row so the
 * rest of the tube build can reuse it.
 *
 * Behavior: mask the input to 8 bits. If it is >= 0x62 it is out of the legal level range, so swap in
 * a POKEY1 random byte ($60ca) ANDed with 0x5f -- a bounded pseudo-random substitute (attract/demo
 * variety). Split the value into quotient (>>4) and remainder (&0x0f). The remainder indexes the ROM
 * shape table at $bc7c (SHAPE_INDEX_TABLE); that entry is stashed to the shape-index cell $112
 * (TUBE_SHAPE_INDEX) and returned packed into the high nibble with the low nibble forced to 0x0f.
 *
 * Live-out: $112 (TUBE_SHAPE_INDEX) holds the resolved table entry; A = packed result, X = quotient,
 * Y = remainder for the caller's continued indexing. Grounding: seen.
 */
export function resolveShapeTableIndex(m, a = m.regs.a) {
  const { mem8 } = m;
  let value = a & 0xff;
  // Out-of-range level id -> bounded POKEY random byte (masked to 0x5f) instead.
  if (value >= 0x62) value = mem8[POKEY1_RANDOM] & 0x5f;
  const quotient = value >> 4;             // high nibble
  const remainder = value & 0x0f;          // low nibble indexes the shape table
  const entry = mem8[u16(SHAPE_INDEX_TABLE + remainder)]; // ROM table $bc7c[remainder]
  mem8[TUBE_SHAPE_INDEX] = entry;          // cache resolved row at $112
  const result = u8(entry << 4) | 0x0f;    // pack: entry in high nibble, low nibble forced to 0x0f
  return [(m.regs.a = result), (m.regs.x = quotient), (m.regs.y = remainder)];
}
