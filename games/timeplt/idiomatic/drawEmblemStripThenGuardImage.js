// SPDX-License-Identifier: GPL-3.0-only
/** drawEmblemStripThenGuardImage — stamp a row of award emblems, then blank the rest of that row.
 * The enable cell gates the whole routine. The caller's count, clamped to six, sets how many
 * two-by-two emblems to stamp leftward from a fixed cursor; the cursor then carries on and the row
 * is blanked down to a fixed floor. A running XOR over a fixed program span guards the image last.
 * LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { stampTwoByTwoTileBlock } from "./stampTwoByTwoTileBlock.js";
import { paintGlyphOverBlankInColourThenStepCursor } from "./paintGlyphOverBlankInColourThenStepCursor.js";
import { PLAY_ACTIVE, IMAGE_GUARD_BLOCK_0711_BASE, EMBLEM_STRIP_FLOOR, EMBLEM_STRIP_TOP } from "./names.js";

const MAX_EMBLEMS = 6;
const EMBLEM_BASE = 9;
const EMBLEM_COLOUR = 24;
const BLANK_GLYPH = 241;
const BLANK_COLOUR = 16;
const CHECK_LEN = 256;
const CHECK_BIAS = 25;

export function drawEmblemStripThenGuardImage(m, count = m.regs.a) {
  const { regs, mem8 } = m;
  if (mem8[PLAY_ACTIVE] === 0) return;

  regs.de = EMBLEM_STRIP_TOP;
  let emblems = count > MAX_EMBLEMS ? MAX_EMBLEMS : count;
  if (emblems !== 0) {
    regs.b = EMBLEM_BASE;
    regs.c = EMBLEM_COLOUR;
    for (; emblems !== 0; emblems--) stampTwoByTwoTileBlock(m);
  }

  regs.b = BLANK_GLYPH;
  regs.c = BLANK_COLOUR;
  while (regs.de >= EMBLEM_STRIP_FLOOR) paintGlyphOverBlankInColourThenStepCursor(m);

  let check = 0;
  for (let i = 0; i < CHECK_LEN; i++) check ^= mem8[IMAGE_GUARD_BLOCK_0711_BASE + i];
  if (u8(check + CHECK_BIAS) !== 0) throw new Error("Time Pilot: program image altered");
}
