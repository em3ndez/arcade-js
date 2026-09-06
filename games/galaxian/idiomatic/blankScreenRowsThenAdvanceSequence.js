// SPDX-License-Identifier: GPL-3.0-only
// VRAM-clear phase step: blank 32 cells at the running VRAM cursor and store the advanced cursor back,
// then tick the phase counter. While phases remain, done; on the last phase advance the sequence state
// and reseed the object shadow.
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { advanceSequenceStateAndReseedObjectShadow } from "./advanceSequenceStateAndReseedObjectShadow.js";
import { VRAM_WRITE_PTR, loc_4009 } from "./names.js";

const BLANK_TILE = 16;
const ROW_CELLS = 32;

export function blankScreenRowsThenAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  const cursor = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, cursor, BLANK_TILE, ROW_CELLS);
  mem16[VRAM_WRITE_PTR] = cursor + ROW_CELLS;

  // Phase countdown: keep going until it reaches zero.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  return advanceSequenceStateAndReseedObjectShadow(m, loc_4009);
}
