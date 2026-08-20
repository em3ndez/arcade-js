// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearBit2AcrossSixSlots — clear bit 2 of the first byte in each of six stride-4 entries.
 *
 * Walks the six leading bytes — (base), (base+4), … (base+20) — clearing bit 2 (mask
 * 0xFB) of each, leaving every other bit untouched. Base comes from the caller; stride
 * (4) and count (6) are fixed here. A leaf: rewrites only those six bytes, calls nothing.
 *
 * LIVE-OUT: memory-only — the six cleared bytes. No register or flag is returned.
 */
export function clearBit2AcrossSixSlots(m, base = m.regs.hl) {
  const { mem8 } = m;

  let addr = base;
  for (let slot = 0; slot < 6; slot++) {
    mem8[addr] = mem8[addr] & 0xfb; // clear bit 2, keep the rest
    addr += 4;
  }
}
