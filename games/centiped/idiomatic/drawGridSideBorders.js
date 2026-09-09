// SPDX-License-Identifier: GPL-3.0-only
import { loc_8b, loc_91, loc_92, loc_a5, loc_a6, loc_f6, loc_f7 } from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * drawGridSideBorders -- draw the two vertical side runs of the play grid's frame.
 *
 * ROM 0x2XXX (grid-border draw; the routine committed waves and the slot-close chain both tail into).
 * Grounding: [code] -- the behaviour is read from the routine; the orientation bytes and cursor cells
 * it touches are behavioural placeholders whose semantics come from how the code uses them.
 *
 * ROLE IN THE MACHINE. Centiped's playfield is a tile-map grid in video RAM (see mechanisms.md,
 * "Playfield grid, tiles + mushroom seeding"). The play area has a visible frame; its two VERTICAL
 * side runs are what this routine repaints. It is called after a wave commits and again by
 * `decrementSlotAndRedrawBorders` every time a spawn slot's turn ends, so the field frame stays
 * intact through the slot churn. The starting offsets in $a5 (loc_a5) and $a6 (loc_a6) are what
 * shrink the play area's sides as the field narrows -- they set how far down each side run the
 * border tiles reach before the rest of the run tapers to blanks.
 *
 * HOW ONE SIDE IS DRAWN. Every grid cell is reached through a single 16-bit "draw cursor": low byte
 * $91 (loc_91), high byte $92 (loc_92). The routine seeds that cursor by folding fixed constants
 * against the $f6/$f7 orientation bytes (loc_f6/loc_f7) -- the same XOR-with-an-orientation-byte
 * trick the whole subsystem uses so one body of code paints both the upright and the mirrored
 * (flipped-cabinet) cabinet without a second copy. It then walks a fixed six-cell run, handing each
 * cell to `writeMaskedByteAndAdvancePointer`, which stamps the glyph through the cursor and steps the
 * cursor to the next cell. The glyph for each cell is chosen by the SIGN of a separate down-counter:
 * a 0x1f border tile while the counter is still non-negative, a 0x00 blank once it has gone negative.
 * So each side is "border for the first few cells, then blank" -- and the offset ($a5 or $a6) at which
 * the counter is loaded is what decides where border turns to blank, i.e. how far the frame reaches.
 *
 * TWICE, MIRRORED. The whole thing runs twice. The second run uses the OPPOSITE cursor constants
 * (0x06^$f7 / 0x5f^$f6 vs 0x04^$f7 / 0xdf^$f6) so it addresses the other side, starts its counter at
 * `6 - $a6` instead of `$a5`, and INVERTS the glyph polarity (blank while non-negative, border once
 * negative) so the two sides taper their border-versus-blank split from opposite ends.
 *
 * LIVE-OUT: the six grid cells of each side run (written via the cursor), the advanced $91/$92 cursor,
 * and $8b left at 0 (the shared six-cell loop counter, decremented to zero by each run).
 */

const BORDER_GLYPH = 0x1f; // the solid border tile stamped into a frame cell
const BLANK_GLYPH = 0x00; // an empty cell (0 = no tile) -- the run tapers to these past the border
const RUN_LEN = 0x06; // each side run paints six cells ($8B counts them down)

export function drawGridSideBorders(m) {
  const { mem8 } = m;

  // FIRST SIDE. Seed the shared six-cell loop counter, then build the draw cursor for this side by
  // folding the orientation bytes: cursor high $92 = a 2-bit stride selector taken from 0x04^$f7 (the
  // `& 0x06` keeps only the two page-stride bits), cursor low $91 = 0xdf^$f6. The XOR-with-$f6/$f7 is
  // the flip-cabinet mirror hinge -- upright and mirrored orientations fall out of the same constants.
  mem8[loc_8b] = RUN_LEN;
  mem8[loc_92] = (0x04 ^ mem8[loc_f7]) & 0x06;
  mem8[loc_91] = 0xdf ^ mem8[loc_f6];
  // The glyph-select down-counter starts at $a5 (this side's border-reach offset). Each cell decrements
  // it first; while it is still non-negative (bit 7 clear) the cell gets a 0x1f border tile, and once it
  // wraps below zero (bit 7 set) the remaining cells get 0x00 blanks. So $a5 sets how tall the border is.
  let counter = mem8[loc_a5];
  do {
    counter = (counter - 1) & 0xff; // 6502 dec: wrap into 0..0xff so bit 7 acts as the sign
    writeMaskedByteAndAdvancePointer(m, (counter & 0x80) === 0 ? BORDER_GLYPH : BLANK_GLYPH);
    mem8[loc_8b] = mem8[loc_8b] - 1; // one of the six cells done
  } while (mem8[loc_8b] !== 0);

  // SECOND SIDE. Opposite constants place the cursor on the other side of the field: high selector from
  // 0x06^$f7 (no masking this time), low cursor 0x5f^$f6. Reload the six-cell counter, and start the
  // glyph-select counter at 6-$a6 (a 6502 `sec; sbc $a6`, wrapped to a byte) so this side's border reach
  // is driven by $a6 counting from the opposite end.
  mem8[loc_92] = 0x06 ^ mem8[loc_f7];
  mem8[loc_91] = 0x5f ^ mem8[loc_f6];
  mem8[loc_8b] = RUN_LEN;
  counter = (RUN_LEN - mem8[loc_a6]) & 0xff; // sec; sbc $a6
  // Note the INVERTED glyph polarity vs the first side: here a non-negative counter picks the BLANK and a
  // negative one picks the BORDER, so this side's frame grows from the other direction -- the pair of
  // runs meet to bound a play area that narrows symmetrically as $a5/$a6 climb.
  do {
    counter = (counter - 1) & 0xff;
    writeMaskedByteAndAdvancePointer(m, (counter & 0x80) === 0 ? BLANK_GLYPH : BORDER_GLYPH);
    mem8[loc_8b] = mem8[loc_8b] - 1;
  } while (mem8[loc_8b] !== 0);
}
