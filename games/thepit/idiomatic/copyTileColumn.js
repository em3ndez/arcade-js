// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyTileColumn — copy a stored run of tile codes straight down a video-RAM column.  ROM 0x3dea.
 *
 * The tile-plotter's counterpart to the solid colour fill. Where the colour arm
 * (fillColourColumn) stamps one repeated colour byte down a colour-RAM column, this
 * copies a run of DISTINCT character codes down the matching video-RAM column, so a
 * stored graphic — a slice of a panel, a label, one high-score record — lands on
 * screen as a vertical strip of the picture.
 *
 * The address setup has already run: deriveTileWriteCursors staged the video-RAM
 * cursor (the address of the column's top cell) at 0x8060, and the run length sits at
 * PLOT_RUN_LENGTH. The source is a table of character codes passed in as `sourcePtr`.
 * It is read one byte per cell walking BACKWARDS through memory while the destination
 * steps one screen row down — 32 cells further along the 32-cell-wide map — per cell,
 * so a table stored back-to-front lands right-way-up down the column.
 *
 * The advanced cursor is written back to 0x8060, so a follow-up run picks up straight
 * below: several panel/record plotters stack two or three of these to build one column
 * before filling the matching colour column.
 *
 * A run length of zero is not a no-op: the length is only checked after the first cell
 * is copied, so zero means a full 256-cell run. Every real caller stages a nonzero
 * length; the wrap is reproduced faithfully, not guarded against.
 *
 * `sourcePtr` is a genuine input the caller sets fresh before every call (it is never
 * carried over from a previous run), so it is an honest JS parameter.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3dea.test.js.
 * GATE:     every real attract dispatch checked on RAM-equivalence (the title/panel/
 *           record plotters feed it many times), plus a sweep over run lengths 1..64 on
 *           a real captured entry, plus an identity check. Teeth: a wrong-row-stride
 *           twin and a twin that drops the cursor write-back. Reached throughout
 *           attract's title/panel draws.
 * LIVE-OUT: memory-only — the copied video-RAM cells and the advanced video cursor
 *           written back to 0x8060. The final source pointer and the leftover work
 *           registers/flags are dead: every caller reloads the source pointer before
 *           its next call and reads the painted memory back, never a leftover register.
 * NAMES:    PLOT_RUN_LENGTH (0x8055 — the shared column-plotter run length). The
 *           video-RAM write cursor 0x8060 has no names.js name — its sibling routines
 *           deriveTileWriteCursors / fillColourColumn keep it hex too — so it stays hex.
 */

import { PLOT_RUN_LENGTH } from "./names.js";

export function copyTileColumn(m, sourcePtr = m.regs.ix) {
  const { mem8, mem16 } = m;

  const count = mem8[PLOT_RUN_LENGTH];
  // Zero means a full 256-cell run (the length is tested only after the first cell).
  const rows = count === 0 ? 256 : count;

  let cell = mem16[0x8060]; // top of the video-RAM column, staged upstream
  let src = sourcePtr; // stored tile-code run, read backwards through memory

  for (let i = 0; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32; // one screen row down = 32 cells along the 32-cell-wide map
    src -= 1; // the source run is walked back one byte per cell
  }

  // Save the advanced cursor so a follow-up run continues straight down the column.
  mem16[0x8060] = cell;
}
