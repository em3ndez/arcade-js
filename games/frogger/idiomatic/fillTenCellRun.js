// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTenCellRun — fill a run of cells with the marker tile.
 * Writes the marker tile into ten consecutive cells from a base the caller supplies in a register,
 * then leaves the pointer just past the run and the loop counter drained to zero, both read back.
 * LIVE-OUT: memory, plus the advanced write pointer and the drained loop counter.
 */
const FILL_TILE = 16;
const RUN = 10;

export function fillTenCellRun(m, base = m.regs.hl) {
  const { mem8 } = m;
  let p = base;
  for (let i = 0; i < RUN; i++) {
    mem8[p] = FILL_TILE;
    p++;
  }
  m.regs.b = 0;
  return (m.regs.hl = p);
}
