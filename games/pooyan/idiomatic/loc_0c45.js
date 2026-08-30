// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * loc_0c45 — little-endian word lookup: fetch table[index] from a word table. [seen] ·
 * ROM 0x0c45–0x0c4d.
 *
 * A foundational table primitive, called from dozens of sites across the machine. The caller
 * supplies a table base and an entry index; this returns the two-byte little-endian word at
 * that entry. Typical uses read ROM word tables — the attract-script pointer table (ROM
 * 0x0bab), indexed by the attract column tick; the level-intro script-timer table, indexed by
 * a clamped round counter — but the routine itself is table-agnostic.
 *
 * The index is DOUBLED before it is added to the base, because each table entry is a 2-byte
 * word: entry N sits at base + N*2. The doubling is taken 8-bit, so an index past 127 wraps
 * rather than reaching beyond a 256-byte span; no live caller relies on that edge.
 *
 * The advanced pointer and the doubled index are left dead — no reader wants them — so the
 * sole meaningful result is the fetched word.
 *
 * LIVE-OUT: the word — returned to direct callers and also mirrored into DE.
 */
export function loc_0c45(m, index = m.regs.a, base = m.regs.hl) {
  const { mem8 } = m;

  // Double the index (8-bit) to turn an entry number into a byte offset: 2 bytes per word.
  const offset = (index << 1) & 0xff;

  // Point at the entry, then read the two bytes there as a little-endian word.
  const ptr = u16(base + offset);
  const word = mem8[ptr] | (mem8[u16(ptr + 1)] << 8);

  return (m.regs.de = word);
}
