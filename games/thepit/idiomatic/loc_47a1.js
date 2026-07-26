// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_47a1 — draw the rightmost playfield column: a 28-tile strip from work RAM up
 *            video column 31, a base colour, then three 3-cell colour accents.  ROM 0x47a1.
 *
 * The tilemap is 32 cells wide, so one screen row is 32 cells and "up one cell in a
 * column" steps back 32. This paints the rightmost column (column 31) three ways:
 *   - A 28-byte tile strip staged in work RAM (0x8282..) is copied up video column 31
 *     (rows 2..29), giving the column its current tile image. Unlike the fixed
 *     left-edge column, this strip is built in RAM, so the picture is dynamic.
 *   - The whole column then gets a base colour of 2, via the still-oracle colour-
 *     column fill; that fill also caches the colour byte in its own paint scratch.
 *   - Finally three 3-cell colour bands accent the column: colour 6 near the bottom
 *     (rows 26..28), colour 4 in the middle (rows 17..19), and colour 7 higher up
 *     (rows 8..10) — the bands sit 7 rows apart, over the base colour just laid down.
 * Writes only hardware video + colour RAM (plus the colour scratch the callee caches);
 * reads only the work-RAM strip. It loads its own source, destinations, counts and
 * colours — no live-in register — and nothing downstream consumes the registers it
 * leaves behind.
 *
 * The role kept a neutral loc_ name: this stamps a single column and its trim, the
 * mirror of the left-edge column stamper loc_46f4, but which playfield feature the
 * right column represents in the game is not yet confidently pinned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-47a1.test.js.
 * GATE:     real dispatch — a screen-draw/board-setup routine that DOES fire in
 *           attract (twice in 1200 frames). Validated at its true captured entry
 *           (oracle vs idiomatic, identical RAM + pc + SP), on extra sampled attract
 *           states for breadth, and on a sentinel background that forces all 56
 *           display writes visible. Teeth: a wrong-accent-colour twin and a
 *           shifted-tile-strip twin, each caught.
 * LIVE-OUT: memory-only — the 28 tile cells, the 28 colour cells, and the colour
 *           byte the still-oracle column fill caches; no live registers/flags.
 * NAMES:    none from ram.js — writes raw video/colour RAM and the callee's own
 *           colour-paint scratch, no named work-RAM address.
 */

export function loc_47a1(m) {
  const { mem8, regs } = m;

  // One tilemap row is 32 cells, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 28-byte tile strip from work RAM up video column 31, bottom cell to top.
  let source = 0x8282;
  let cell = 0x93bf;
  for (let i = 0; i < 28; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Base-colour the whole column: stamp colour 2 down colour column 31 (selector 31).
  // This stays the frozen oracle, so its inputs are handed over the register boundary
  // and it pops the return address pushed here on its way back.
  regs.c = 2; // the colour byte to fill down the column
  regs.a = 31; // column selector: colour column 31
  m.push16(0x47bd); // return address the oracle callee pops when it finishes
  m.call(0x3e1d);

  // Accent the base colour with three 3-cell bands, each painted upward from its own
  // bottom cell; the bands sit 7 rows apart.
  paintColourBand(mem8, 0x8b9f, 6); // rows 26..28
  paintColourBand(mem8, 0x8a7f, 4); // rows 17..19
  paintColourBand(mem8, 0x895f, 7); // rows 8..10
}

/** Write `colour` into three colour cells starting at `bottom` and stepping upward one row at a time. */
function paintColourBand(mem8, bottom, colour) {
  let cell = bottom;
  for (let i = 0; i < 3; i++) {
    mem8[cell] = colour;
    cell -= 32; // step up one row = one cell up the column
  }
}
