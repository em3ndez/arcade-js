// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0779 — fill a run of cells with the marker tile.
 * Writes the marker tile into ten consecutive cells from a base the caller supplies in a register,
 * then leaves the pointer just past the run and the loop counter drained to zero, both read back.
 * LIVE-OUT: memory, plus the advanced write pointer and the drained loop counter.
 */
const FILL_TILE = 16;
const RUN = 10;

export function loc_0779(m, base = m.regs.hl) {
  const { mem8 } = m;
  let p = base;
  for (let i = 0; i < RUN; i++) {
    mem8[p] = FILL_TILE;
    p = (p + 1) & 0xffff;
  }
  m.regs.hl = p;
  m.regs.b = 0;
}
