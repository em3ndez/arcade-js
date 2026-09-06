// SPDX-License-Identifier: GPL-3.0-only
// Sequence state (index 2): fill two blank-tile rows through the VRAM write cursor and step it a full
// row-pair stride, then count down the row tier. While rows remain it returns; on the last row it advances
// the state, clears the screen-flip latches and a direction flag, queues two command words, and drives the
// start-button lamps.
import { u16 } from "../../../core/int.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { driveStartButtonLamps } from "./driveStartButtonLamps.js";
import {
  VRAM_WRITE_PTR, loc_4009, SEQUENCE_STATE, loc_4018, FLIP_SCREEN_X, FLIP_SCREEN_Y,
} from "./names.js";

const FILL_TILE = 16; // blank/fill tile value
const RUN = 28;       // bytes filled per row
const GAP = 4;        // skip from one row's end to the next row's start

export function loc_0443(m) {
  const { mem8, mem16 } = m;

  let ptr = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, ptr, FILL_TILE, RUN);
  ptr = u16(ptr + RUN + GAP);
  fillMemoryBlock(m, ptr, FILL_TILE, RUN);
  ptr = u16(ptr + RUN + GAP);
  mem16[VRAM_WRITE_PTR] = ptr;

  mem8[loc_4009] = mem8[loc_4009] - 1; // store truncates: a 0 tier wraps to 255 and keeps counting
  if (mem8[loc_4009] !== 0) return; // more rows remain

  mem8[SEQUENCE_STATE]++;
  mem8[FLIP_SCREEN_X] = 0; // screen-flip latches off
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;

  enqueueCommandWord(m, (7 << 8) | 2);
  enqueueCommandWord(m, (6 << 8) | 1);

  driveStartButtonLamps(m);
}
