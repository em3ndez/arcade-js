// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColourColumn — paint a vertical run of colour-RAM cells with one colour byte.  ROM 0x3e01.
 *
 * The last step of the colour-column paint pipeline. An upstream step has already
 * staged three values in scratch RAM: the colour-RAM cursor (the address of the
 * column's top cell, left there by deriveTileWriteCursors), how many cells to paint,
 * and the colour byte to stamp. This walks straight down that column — one screen row
 * per step, which is 32 cells further along the 32-cell-wide map — writing the colour
 * byte into each cell until the row count is used up.
 *
 * The panel / record / HUD painters (cycleStagedColumnColour, drawPlayerLabel, loc_4816, drawMenLeftPanel) each
 * finish by handing off to this, so a whole colour column lands from one call.
 *
 * A row count of zero is not a no-op: the count is only checked after the first cell
 * is painted, so zero means a full 256-cell run. Every real caller stages a nonzero
 * count; the wrap is reproduced faithfully, not guarded against.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e01.test.js.
 * GATE:     every real attract dispatch checked on the full contract (RAM + pc + SP;
 *           the colour painters feed it ~31 times in 1200 frames), plus a sweep over
 *           row counts 1..64 on a real captured entry (whole-RAM vs the oracle, proving
 *           every loop length paints identically) and a crafted zero-count entry that
 *           exercises the 256-cell wrap. Teeth: a wrong-row-stride twin. Reached
 *           throughout attract's colour draws.
 * LIVE-OUT: memory-only — the painted colour-RAM cells. The leftover cursor / count /
 *           flag registers are dead: the painters tail-jump in, so the return lands in
 *           their own caller, whose next act re-stages its scratch and reads painted
 *           memory, never a leftover register.
 * NAMES:    COLOUR_RAM_CURSOR (0x805e) and PLOT_RUN_LENGTH (0x8055) from ram.js. 0x8057
 *           (the colour fill byte) is a colour-paint staging cell the sibling
 *           deriveTileWriteCursors keeps hex; ram.js names 0x8057 BOARD_MODE for a
 *           mode-index role used elsewhere, which does not describe the colour byte
 *           staged here, so it is kept hex rather than misread.
 */

import { COLOUR_RAM_CURSOR, PLOT_RUN_LENGTH } from "./ram.js";
export function fillColourColumn(m) {
  const { mem8, mem16 } = m;

  const cursor = mem16[COLOUR_RAM_CURSOR]; // address of the column's top colour cell
  const count = mem8[PLOT_RUN_LENGTH]; // how many cells to paint down the column
  const colour = mem8[0x8057]; // the colour byte to stamp into each cell

  // Zero means a full 256-cell run (the count is tested only after the first paint).
  const rows = count === 0 ? 256 : count;

  let cell = cursor;
  for (let i = 0; i < rows; i++) {
    mem8[cell] = colour;
    cell += 32; // one screen row down = 32 cells along the 32-cell-wide map
  }
}
