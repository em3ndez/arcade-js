// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyByteDisplaced — copy one byte from an indexed cell to a cell a fixed distance away.
 *
 * A generic addressing primitive. Three values arrive from the caller: a base address, an index
 * to add to it, and a signed displacement. The byte at base-plus-index is read and an identical
 * copy is stored at base-plus-index-plus-displacement — the destination is simply the source,
 * moved by the displacement. Both additions are 16-bit and WRAP.
 *
 * It writes one byte, reads one byte, reads nothing else, and calls nothing.
 *
 * In play it is used to slide a tilemap cell one row up the screen, by handing it a displacement
 * of minus one row's worth of cells — but the routine itself knows nothing about rows or about
 * the screen. Any displacement works, which is why it is named for the addressing it does rather
 * than for the effect the caller gets out of it.
 *
 * LIVE-OUT: memory-only — the one byte written at the displaced address.
 */
export function copyByteDisplaced(m) {
  const { regs, mem } = m;

  // source = base + index; destination = source + displacement. Both wrap at 16 bits.
  const src = (regs.hl + regs.bc) & 0xffff;
  const dst = (src + regs.de) & 0xffff;
  mem.write8(dst, mem.read8(src));

  // Nothing is handed back: the caller reloads everything it needs before reading it, so the
  // addresses computed above are not written into any register.
}
