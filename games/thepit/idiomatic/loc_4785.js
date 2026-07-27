// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4785 — stamp a fixed edge column, then hand off to the colour fill to tint it.  ROM 0x4785.
 *
 * The tilemap is 32 cells wide, so one screen row is 32 bytes and stepping "up a
 * column" means stepping back one row. This copies a 32-byte picture strip stored
 * in ROM up a single video column (top cell first, walking upward), giving that
 * column its fixed tile image, then hands the matching colour column to the shared
 * colour-column fill so the two land from one call.
 *
 * It is the sibling of drawLeftEdgeColumn: its ROM strip begins exactly 32 bytes past that
 * routine's, so it draws the neighbouring edge column with the identical copy loop.
 * Unlike drawLeftEdgeColumn (which paints its own colour runs and returns), this one delegates
 * the colour work: it asks the fill to paint 28 cells of colour 1 down the colour
 * column at offset 30. The fill ends by returning straight to our caller.
 *
 * Loads its own source, destination, and count — no live-in register, no work RAM
 * read; writes only hardware video RAM here, and whatever the colour fill writes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4785.test.js.
 * GATE:     real dispatch — the board-setup draw reaches 0x4785 once early in a
 *           plain attract run; captured there and diffed on the full contract
 *           (RAM + pc + SP), plus a sentinel-background pass that forces every
 *           write visible, plus teeth.
 * LIVE-OUT: memory-only — the 32 tile cells written here plus the colour cells the
 *           fill writes; no live registers/flags (the leftover register file is
 *           dead ABI, reloaded by whatever draws next).
 * NAMES:    none — writes only raw video RAM; the offset/colour handed to the fill
 *           are its register inputs at the oracle boundary, not named work RAM.
 */
import { fillColourColumnAt } from "./fillColourColumnAt.js";

export function loc_4785(m) {
  const { mem8 } = m;

  // One tilemap row is 32 bytes, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 32-byte picture strip from ROM up the video column, top cell first.
  let source = 0x4acb;
  let cell = 0x93fe;
  for (let i = 0; i < 32; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Hand off to the shared colour-column fill: paint 28 cells of colour 1 down the
  // colour column at offset 30. Its own return goes straight to our caller, so this
  // is the routine's tail — nothing runs here afterward.
  return fillColourColumnAt(m, 30, 1); // columnOffset 30, colour 1
}
