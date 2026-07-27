// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyCappedTileColumn — copy a tile-code run down a video-RAM column, but cap the top cell.  ROM 0x3ddb.
 *
 * The capped variant of the plain tile-column copy (copyTileColumn). It paints the
 * same kind of vertical strip — one screen row per step, which is 32 cells further
 * along the 32-cell-wide map — into a video-RAM column, but the TOP cell is forced to a
 * fixed cap tile instead of coming from the source. So a strip gets a distinct lid on
 * its top cell (a border/header tile) with the rest of the picture below it.
 *
 * The address setup has already run: an upstream step staged the video-RAM cursor (the
 * address of the column's top cell) at 0x8060 and the run length at PLOT_RUN_LENGTH.
 * The cap tile is a fixed graphics constant read from the ROM. The body cells copy from
 * `sourcePtr`, a table of character codes walked BACKWARDS through memory (one byte per
 * body cell), so a table stored back-to-front lands right-way-up below the cap.
 *
 * The one subtlety, and the whole reason this is a separate routine from copyTileColumn:
 * only the top cell takes the cap; the source walk begins one byte BELOW `sourcePtr`
 * (the pointer's own first byte is never read — it is the position the cap replaces).
 * Getting that wrong silently paints the source's first byte on top of the column
 * instead of the cap.
 *
 * The advanced cursor is written back to 0x8060, so a follow-up run picks up straight
 * below: panel/label plotters stack a couple of these to build one column.
 *
 * A run length of zero is not a no-op: the length is only checked after the first cell
 * is painted, so zero means a full 256-cell run (cap + 255 body cells). Every real
 * caller stages a nonzero length; the wrap is reproduced faithfully, not guarded.
 *
 * `sourcePtr` is a genuine input the caller sets fresh before every call, so it is an
 * honest JS parameter.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3ddb.test.js.
 * GATE:     every real attract dispatch checked on RAM-equivalence (the HUD/panel
 *           plotters reach it), plus a run-length sweep 1..64 on a real captured entry,
 *           plus an identity check. Teeth: a cap-confusion twin (top cell takes the
 *           source's first byte, this routine's whole distinction), a wrong-row-stride
 *           twin, and a twin that drops the cursor write-back.
 * LIVE-OUT: memory-only — the painted video-RAM cells and the advanced video cursor
 *           written back to 0x8060. The final source pointer and the leftover work
 *           registers/flags are dead: every caller reloads the source pointer before its
 *           next call and reads the painted memory back, never a leftover register.
 * NAMES:    PLOT_RUN_LENGTH (0x8055 — the shared column-plotter run length). The video-RAM
 *           write cursor 0x8060 has no ram.js name — its sibling routines
 *           copyTileColumn / deriveTileWriteCursors keep it hex too — so it stays hex.
 *           0x4b0f is the ROM address of the fixed cap tile, kept hex.
 */

import { PLOT_RUN_LENGTH } from "./ram.js";

// ROM address of the fixed tile that caps the top of the column.
const CAP_TILE = 0x4b0f;

export function copyCappedTileColumn(m, sourcePtr) {
  const { mem8, mem16 } = m;

  const count = mem8[PLOT_RUN_LENGTH];
  // Zero means a full 256-cell run (the length is tested only after the first cell).
  const rows = count === 0 ? 256 : count;

  let cell = mem16[0x8060]; // top of the video-RAM column, staged upstream

  // The top cell takes the fixed cap tile.
  mem8[cell] = mem8[CAP_TILE];
  cell += 32; // one screen row down = 32 cells along the 32-cell-wide map

  // The body cells copy from the source run, which starts one byte below the pointer
  // (the pointer's own first byte is the position the cap replaced) and is walked back
  // one byte per cell.
  let src = sourcePtr - 1;
  for (let i = 1; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32;
    src -= 1;
  }

  // Save the advanced cursor so a follow-up run continues straight down the column.
  mem16[0x8060] = cell;
}
