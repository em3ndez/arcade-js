// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_483a — paint one HUD/text panel at column 5, in one of two variants.  ROM 0x483a.
 *
 * Draws a single vertical panel column whose look is chosen from a live work-RAM
 * byte. The column is always at column 5; a decision byte picks the variant:
 *   - default variant (the byte is anything but 1): a nine-glyph label at row 11,
 *     then one more cell below it showing the live byte itself, and the whole
 *     ten-cell run painted in one colour.
 *   - alternate variant (the byte equals 1): an eight-glyph label at row 12, the
 *     eight-cell run painted in a neighbouring colour, and no live value cell.
 *
 * It works the same way as the sibling panel painters: name the target cell,
 * ask the shared address helpers to turn it into the tilemap offset and the
 * matching colour-RAM / video-RAM write cursors, then drive the copy helper to
 * stamp the glyphs down the video column (the video cursor is carried forward
 * between fields, so each field continues directly below the previous one), and
 * finally tail-jump into the colour-column filler, which paints the whole run in
 * the attribute and returns to this routine's caller.
 *
 * THE FIVE LAYOUT HELPERS ARE STILL THE FROZEN ORACLE, reached through the registry.
 * Each returns through the machine's stack, so every call is bracketed with the
 * return address it expects to find there — a genuine oracle boundary. This game
 * keeps the Z80 stack (top of work RAM) byte-identical to the hardware, so
 * reproducing those return-address pushes is what keeps this routine a faithful
 * drop-in: the work RAM, stack included, lands exactly as the oracle leaves it.
 * (When these helpers are later decompiled, the pushes dissolve into ordinary calls.)
 *
 * Name kept as loc_483a: it is clearly a two-variant panel painter, but which
 * specific field it draws — and what the live byte counts — is not pinned, and it
 * is one of a family of near-identical panel painters; below the bar for an
 * English name (same call as its sibling loc_3d49).
 *
 * Memory-equivalent to the frozen oracle — equivalence-483a.test.js.
 * GATE:     crafted-entry — attract never dispatches 0x483a; the entry is captured
 *           at a real sibling-panel dispatch (frame 61) and both decision-byte arms
 *           are forced identically on each side. Oracle vs idiomatic diffed on clones
 *           of that entry — full whole-dump equivalence, no exclusions; teeth caught.
 * LIVE-OUT: memory-only — the panel's tilemap + colour cells and the layout scratch
 *           (0x805a offset, 0x805e/0x8060 cursors). The routine tail-jumps into the
 *           colour filler, whose return goes to our caller. Because the oracle's stack
 *           pushes are reproduced, the stack, stack pointer, exit address, and register
 *           file also land identical — the full contract, not just the minimum.
 * NAMES:    TILE_COL, TILE_ROW from ram.js. 0x8057 kept local (FILL_ATTR) — ram.js
 *           proposes BOARD_MODE for it, but here the byte is unambiguously the panel's
 *           colour, so a local role name fits better than a misfit import. 0x8055
 *           (CELL_COUNT), the live decision/display byte 0x802b, and the ROM label
 *           sources 0x49ba / 0x49c2 are not in ram.js and stay local.
 */

import { TILE_COL, TILE_ROW } from "./ram.js";

// The colour attribute the panel is painted in. ram.js proposes BOARD_MODE for
// 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_ATTR = 0x8057;

// How many cells the next copy/fill helper writes (reloaded before each field).
const CELL_COUNT = 0x8055;

// The live work-RAM byte that selects the variant and, in the default variant, is
// itself copied into the panel's last cell as the displayed value.
const PANEL_VALUE = 0x802b;

// ROM glyph sources for the two labels (walked backwards by the copy helper).
const DEFAULT_LABEL = 0x49ba;
const ALT_LABEL = 0x49c2;

export function loc_483a(m) {
  const { mem, regs } = m;

  // The panel column is always 5.
  mem.write8(TILE_COL, 5);

  if (mem.read8(PANEL_VALUE) === 1) {
    // Alternate variant: an eight-glyph label at row 12, no live-value cell.
    mem.write8(TILE_ROW, 12);

    // Turn (row, col) into the tilemap offset, then derive the colour-RAM and
    // video-RAM write cursors. (The pushed addresses are where each call resumes;
    // reproducing them satisfies the still-oracle helpers' stack returns.)
    m.push16(0x487d); m.call(0x3dae);
    m.push16(0x4880); m.call(0x3dc9);

    // Paint the panel in colour attribute 150.
    mem.write8(FILL_ATTR, 150);

    // The eight-glyph label, stamped down the video column.
    mem.write8(CELL_COUNT, 8);
    regs.ix = ALT_LABEL; // the source pointer the copy helper reads
    m.push16(0x4891); m.call(0x3dea);

    // Colour the full eight-cell run and hand off to the colour-column filler; its
    // return unwinds straight to our caller, so this is loc_483a's exit.
    return m.call(0x3e01);
  }

  // Default variant: a nine-glyph label at row 11, then the live value below it.
  mem.write8(TILE_ROW, 11);

  m.push16(0x484d); m.call(0x3dae);
  m.push16(0x4850); m.call(0x3dc9);

  // Paint the panel in colour attribute 151.
  mem.write8(FILL_ATTR, 151);

  // The nine-glyph label field.
  mem.write8(CELL_COUNT, 9);
  regs.ix = DEFAULT_LABEL; // the source pointer the copy helper reads
  m.push16(0x4861); m.call(0x3dea);

  // One more cell: the live value itself, continuing down the same video column.
  mem.write8(CELL_COUNT, 1);
  regs.ix = PANEL_VALUE; // display the live byte as the panel's last cell
  m.push16(0x486d); m.call(0x3dea);

  // Colour the full ten-cell run, then hand off to the colour-column filler; its
  // return unwinds straight to our caller, so this is loc_483a's exit (a tail
  // hand-off, which pushes nothing — the filler's own return address is our caller's).
  mem.write8(CELL_COUNT, 10);
  return m.call(0x3e01);
}
