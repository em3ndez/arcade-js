// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler: clear the strided table, blank a 28-cell row at the VRAM cursor and step the
// cursor one row on. Tick the dwell timer; while it still runs, done. On expiry advance the sequence
// step, clear the object-source and sprite-shadow blocks, re-arm the two-tier dwell, reseed the object
// shadow from its template, and queue command word 6.
import { clearStridedTable } from "./clearStridedTable.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { seedObjectShadowFromRom } from "./seedObjectShadowFromRom.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  VRAM_WRITE_PTR,
  loc_4008,
  loc_4009,
  SEQUENCE_STATE,
  SPRITE_SOURCE_OBJ_BASE,
  SPRITE_SHADOW_BASE,
} from "./names.js";

const BLANK_TILE = 16;
const ROW_CELLS = 28;   // cells blanked per tick
const ROW_STRIDE = 32;  // cursor step to the next row

export function blankVramRowThenResetSpriteState(m) {
  const { mem8, mem16 } = m;

  clearStridedTable(m);

  const cursor = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, cursor, BLANK_TILE, ROW_CELLS);
  mem16[VRAM_WRITE_PTR] = cursor + ROW_STRIDE;

  // Dwell countdown: keep waiting until it reaches zero.
  const dwell = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = dwell;
  if (dwell !== 0) return;

  mem8[SEQUENCE_STATE]++;
  fillMemoryBlock(m, SPRITE_SOURCE_OBJ_BASE, 0, 0);  // count 0 -> full 256-byte clear
  fillMemoryBlock(m, SPRITE_SHADOW_BASE, 0, 64);
  mem8[loc_4008] = 64; // re-arm the sub-timer tier
  mem8[loc_4009] = 4;  // re-arm the dwell tier
  seedObjectShadowFromRom(m);
  return enqueueCommandWord(m, 6 << 8); // queue command word 6
}
