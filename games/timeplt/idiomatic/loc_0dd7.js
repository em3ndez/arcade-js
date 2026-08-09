// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd7 — paint a value 0..99 as a row of denomination blocks at a fixed cell, then fold a
 * three-word integrity sum and cold-start the machine if it fails. The value is clamped to 99 and
 * split greedily into thirties, tens, fives and ones; each count paints that many blocks, smallest
 * first so the row fills right to left, and the rest of the row is padded with the blank glyph.
 * LIVE-OUT: the painted row and its colour; a failed sum hands off to the cold-start entry.
 */

import { loc_0000 } from "./loc_0000.js";
import { drawSlotWithOneGlyph } from "./drawSlotWithOneGlyph.js";
import { paintDoubleTile } from "./paintDoubleTile.js";
import { paintQuadTile } from "./paintQuadTile.js";

const ROW_START = 0xa463;
const ROW_END = 0xa623;
const BLANK_GLYPH = 0xf1;
const BLANK_COLOUR = 0x10;
const CHECKSUM_TARGET = 0x69;

export function loc_0dd7(m) {
  const { regs, mem16 } = m;

  let value = regs.a >= 100 ? 99 : regs.a;
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

  regs.de = ROW_START;
  for (const [count, glyph, colour, paint] of denominations) {
    if (!count) continue;
    regs.b = glyph;
    regs.c = colour;
    for (let i = 0; i < count; i++) paint(m);
  }

  regs.b = BLANK_GLYPH;
  regs.c = BLANK_COLOUR;
  while (regs.de < ROW_END) drawSlotWithOneGlyph(m);

  regs.xor(regs.a);
  regs.hl = mem16[0x00a0];
  regs.de = mem16[0x00a3];
  regs.bc = mem16[0x009d];
  regs.addHl(regs.de);
  regs.addHl(regs.bc);
  regs.add(regs.l);
  regs.add(regs.h);
  regs.sub(CHECKSUM_TARGET);
  if (regs.fNZ) return loc_0000(m);
}
