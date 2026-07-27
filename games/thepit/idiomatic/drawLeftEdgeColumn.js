// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLeftEdgeColumn — stamp the fixed playfield edge column: a 32-tile picture strip up
 * video column 0, then three fixed colour runs that tint it.  ROM 0x46f4.
 *
 * The tilemap is 32 cells wide, so one screen row is 32 bytes and stepping "up a
 * column" means stepping back one row. This paints the first tilemap column
 * (offset 0 within every row, all 32 rows) plus its colour attributes:
 *   - A 32-byte picture strip stored in ROM is copied up video column 0, giving
 *     that column its fixed tile image.
 *   - Three colour runs then tint the column: colour 2 for a 9-cell run and a
 *     second 9-cell run, and colour 3 for a 10-cell run, each painted upward
 *     from its own starting cell.
 * Writes only hardware video + colour RAM; reads only the ROM strip. It loads its
 * own source, destinations, counts, and colours — no live-in register, no work
 * RAM — and nothing downstream consumes the registers it leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-46f4.test.js.
 * GATE:     crafted-entry; a board-setup routine (called from the screen-draw
 *           setup, not attract), so it never dispatches in a plain attract run.
 *           Validated on real captured attract machine states used as realistic
 *           bases — the writes depend on nothing but the fixed ROM strip, so any
 *           real state is a valid entry — plus a sentinel-background pass that
 *           forces all 60 writes visible, plus teeth.
 * LIVE-OUT: memory-only — the 32 tile cells and 28 colour cells it writes; no
 *           live registers/flags.
 * NAMES:    none — writes only raw video/colour RAM, no named work-RAM address.
 */
export function drawLeftEdgeColumn(m) {
  const { mem8 } = m;

  // One tilemap row is 32 bytes, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 32-byte picture strip from ROM up video column 0, bottom cell to top.
  let source = 0x4aab;
  let cell = 0x93e0;
  for (let i = 0; i < 32; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Tint that column: two 9-cell runs of colour 2, then a 10-cell run of colour 3,
  // each painted upward from its own top cell.
  paintColourRun(mem8, 0x8ba0, 9, 2);
  paintColourRun(mem8, 0x8940, 9, 2);
  paintColourRun(mem8, 0x8a80, 10, 3);
}

/** Write `colour` into `count` colour cells starting at `top` and stepping upward one cell at a time. */
function paintColourRun(mem8, top, count, colour) {
  let cell = top;
  for (let i = 0; i < count; i++) {
    mem8[cell] = colour;
    cell -= 32; // step up one row (one column cell)
  }
}
