// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearBit2AcrossSixSlots — clear bit 2 of the leading byte in each of six
 * stride-4 table entries.
 *
 * ROM 0x0e46-0x0e52. Grounding: [code].
 *
 * The caller supplies a base address in HL pointing at a six-entry table whose
 * entries are spaced four bytes apart. This walks the leading byte of each entry —
 * (base), (base+4), (base+8), … (base+20) — and clears bit 2 of it (AND with the
 * mask 0xFB), leaving every other bit of that byte untouched. Bit 2 is one flag in
 * a per-entry attribute byte; clearing it across all six entries at once turns that
 * one flag off table-wide without disturbing the entry's other state.
 *
 * The stride (4) and the count (6) are fixed in the routine; only the base address
 * is a caller input.
 *
 * A pure leaf: it rewrites only those six bytes and calls nothing. It was split out
 * of the surrounding 0x0e00 code range as its own routine, and no static caller is
 * known — it is reached through gameplay/dynamic dispatch — which is why the role is
 * grounded at [code] rather than [seen].
 *
 * LIVE-OUT: memory only — the six masked bytes. No register or flag is returned.
 */

export function clearBit2AcrossSixSlots(m, base = m.regs.hl) {
  const { mem8 } = m;

  // Walk the six entries, four bytes apart, clearing bit 2 of each leading byte.
  let addr = base;
  for (let slot = 0; slot < 6; slot++) {
    mem8[addr] = mem8[addr] & 0xfb; // AND 0xFB: clear bit 2, keep every other bit
    addr += 4; // advance to the next stride-4 entry
  }
}
