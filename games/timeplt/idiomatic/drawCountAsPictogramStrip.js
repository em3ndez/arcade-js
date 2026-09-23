// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCountAsPictogramStrip — paint a value 0..99 as a row of denomination blocks at a fixed cell, then fold a
 * three-word integrity sum and cold-start the machine if it fails. The value is clamped to 99 and
 * split greedily into thirties, tens, fives and ones; each count paints that many blocks, smallest
 * first so the row fills right to left, and the rest of the row is padded with the blank glyph.
 * LIVE-OUT: the painted row and its colour; a failed sum hands off to the cold-start entry.
 */

import { trampolineToSeatTheStackAndSettleTheControlLatch } from "./trampolineToSeatTheStackAndSettleTheControlLatch.js";
import { drawSlotWithOneGlyph } from "./drawSlotWithOneGlyph.js";
import { paintDoubleTile } from "./paintDoubleTile.js";
import { paintQuadTile } from "./paintQuadTile.js";
import { IMAGE_CHECKSUM_WORD_009D, IMAGE_CHECKSUM_WORD_00A0, IMAGE_CHECKSUM_WORD_00A3, COUNT_PICTOGRAM_STRIP_START, EMBLEM_STRIP_FLOOR } from "./names.js";

const BLANK_GLYPH = 0xf1;
const BLANK_COLOUR = 0x10;
const CHECKSUM_TARGET = 0x69;

// paintQuadTile hands back [colourPtr, cursor]; the slot painters hand back the cursor alone.
const nextCursor = (ret) => (Array.isArray(ret) ? ret[1] : ret);

export function drawCountAsPictogramStrip(m, a = m.regs.a) {
  const { mem16 } = m;

  let value = a >= 100 ? 99 : a;
  const thirties = Math.floor(value / 30); value %= 30;
  const tens = Math.floor(value / 10); value %= 10;
  const fives = Math.floor(value / 5); value %= 5;
  const ones = value;

  const denominations = [
    [ones, 0x01, 0x13, drawSlotWithOneGlyph],
    [fives, 0x32, 0x11, paintDoubleTile],
    [tens, 0xce, 0x16, paintQuadTile],
    [thirties, 0x23, 0x11, paintQuadTile],
  ];

  let cursor = COUNT_PICTOGRAM_STRIP_START;
  for (const [count, glyph, colour, paint] of denominations) {
    for (let i = 0; i < count; i++) cursor = nextCursor(paint(m, cursor, glyph, colour));
  }
  while (cursor < EMBLEM_STRIP_FLOOR) cursor = drawSlotWithOneGlyph(m, cursor, BLANK_GLYPH, BLANK_COLOUR);

  const sum = mem16[IMAGE_CHECKSUM_WORD_00A0] + mem16[IMAGE_CHECKSUM_WORD_00A3] + mem16[IMAGE_CHECKSUM_WORD_009D];
  const fold = ((sum & 0xff) + ((sum >> 8) & 0xff) - CHECKSUM_TARGET) & 0xff;
  if (fold !== 0) return trampolineToSeatTheStackAndSettleTheControlLatch(m);
}
