// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawTerrainColumn — write one vertical strip of tiles up a backdrop column, then tick the
 * animation clock.  ROM 0x2fb7.
 *
 * The dirt/shaft backdrop refreshes one vertical strip of tiles per animation step.
 * This is that strip's write. Starting at the column's bottom cell it copies a run
 * of tile codes out of a pattern table into the tile-map, stepping one screen row
 * up the column after each cell, until the run is used up.
 *
 * The source pointer, the destination cell, the one-row-up step, and the run length
 * all arrive in registers from the still-oracle animation-step code that stages them
 * just before falling into this blit — a genuine oracle boundary, so they are read
 * off the machine rather than taken as parameters.
 *
 * A run length of zero is not a no-op: the length is only checked after the first
 * cell is written, so zero means a full 256-cell run. The setup always stages a
 * six-cell run; the wrap is reproduced faithfully, not guarded against.
 *
 * When the column is written the routine falls through into the animation phase
 * clock (the already-decompiled loc_2fc0), whose return goes to our caller — so that
 * hand-off is this routine's exit, not a nested call.
 *
 * Named drawTerrainColumn: same best-effort backdrop-animation subsystem as its
 * siblings loc_2fc0 / setBgSpriteFrame (both left neutral), and while the strided tile-map
 * copy is mechanically clear its game-role is an inference — below the bar to promote.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fb7.test.js.
 * GATE:     crafted-entry — the blit is never dispatched at this address in attract
 *           (the column-animation step inlines the same body), so real attract states
 *           are captured at the reachable sibling loc_2f71 and the four blit registers
 *           are set to the values the real setup produces (source into the pattern
 *           table, the column's bottom cell, the one-row-up step, a six-cell run),
 *           swept over run lengths and source offsets, plus a zero-length run that
 *           exercises the 256-cell wrap and a sweep of the animation phase that drives
 *           all three of loc_2fc0's arms through the delegation. The two still-oracle
 *           animation tails (0x2fe3, 0x3029) are delegated to one identical stub each
 *           on both sides. Teeth twins (wrong step, dropped cell) are caught.
 * LIVE-OUT: memory-only — the tile-map cells written plus the phase-clock memory the
 *           tail updates. The run pointers and count left in registers are dead: the
 *           phase clock overwrites the working registers and never reads them.
 * NAMES:    none from ram.js — the inputs are registers and the writes land in the
 *           tile-map (video RAM), neither a named work-RAM field; the phase-clock tail
 *           is the decompiled loc_2fc0.
 */

import { loc_2fc0 } from "./loc_2fc0.js";

export function drawTerrainColumn(m) {
  const { regs, mem8 } = m;

  // Blit parameters staged in registers by the oracle animation-step code.
  let src = regs.ix; // read cursor into the tile-pattern table
  let dst = regs.hl; // the column's bottom tile-map cell
  const rowStep = regs.de; // step to the next cell one screen row up (a negative stride)
  let remaining = regs.b; // number of cells to write (zero means a full 256-cell run)

  // Copy the run of tile codes up the column, one cell per screen row. The count is
  // tested only after each write, so a zero start writes the full 256 cells.
  do {
    mem8[dst] = mem8[src];
    dst = (dst + rowStep) & 0xffff;
    src = (src + 1) & 0xffff;
    remaining = (remaining - 1 + 256) % 256;
  } while (remaining !== 0);

  // Fall through into the animation phase clock; its return goes to our caller, so
  // this hand-off is drawTerrainColumn's exit.
  return loc_2fc0(m);
}
