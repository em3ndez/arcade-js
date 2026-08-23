// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * loc_0c45 — little-endian word lookup: return table[index] from a word table.
 *
 * The index is doubled (8-bit, so it wraps past 128 entries), added to the base, and the two bytes
 * there form the word. The advanced pointer and the doubled index are left dead — no reader wants
 * them — so the sole live-out is the word.
 *
 * LIVE-OUT: the word — returned for direct callers and mirrored to DE for the register dispatch.
 */
export function loc_0c45(m, index = m.regs.a, base = m.regs.hl) {
  const { mem8 } = m;
  const offset = (index << 1) & 0xff;
  const ptr = u16(base + offset);
  const word = mem8[ptr] | (mem8[u16(ptr + 1)] << 8);
  return (m.regs.de = word);
}
