// SPDX-License-Identifier: GPL-3.0-only

/**
 * blankVramRowThenResetSpriteState (ROM 0x029d) — attract sequence-state handler (state index 9).
 *
 * WHAT IT IS
 *   A multi-frame attract step. Each tick it clears the strided scratch table, blanks a 28-cell VRAM row at
 *   the fill cursor, and steps the cursor one row on; it ticks a dwell timer and, only when the dwell
 *   expires, performs the heavier reset: advance the sequence, wipe the object-source and sprite-shadow
 *   blocks, re-arm the two-tier dwell, reseed the object shadow, and queue a display command.
 *
 * ROLE IN THE MACHINE
 *   Dispatched by runAttractSequenceAndAdvanceOnCredit (0x0156, game-state 1) when SEQUENCE_STATE == 9
 *   (mechanisms.md "attract loop"). VRAM_WRITE_PTR (0x400b) is the fill cursor, blanked with tile 16 a row
 *   (28 cells, +32 stride) per frame. loc_4009 is the dwell tier of the timer cascade. On expiry it bumps
 *   SEQUENCE_STATE (0x400a); clears SPRITE_SOURCE_OBJ_BASE (0x42b0, the 8 object records read as sprite
 *   sources — a fillMemoryBlock count of 0 means a full 256-byte clear) and SPRITE_SHADOW_BASE (0x4060, the
 *   64-byte sprite staging shadow); re-arms the sub-timer tier loc_4008 = 64 and dwell tier loc_4009 = 4;
 *   reseeds the stride-2 OBJRAM shadow from ROM via seedObjectShadowFromRom; and enqueues command word
 *   6<<8 = 0x0600 (channel selector 6, parameter 0) through enqueueCommandWord.
 *
 * ROM 0x029d.  Grounding: [seen].
 *
 * LIVE-OUT: the strided table (cleared); a blanked 28-cell VRAM row; VRAM_WRITE_PTR (+32); loc_4009; and,
 *   on dwell expiry, SEQUENCE_STATE, the SPRITE_SOURCE_OBJ_BASE / SPRITE_SHADOW_BASE blocks, loc_4008,
 *   loc_4009, the OBJRAM shadow, and one command-ring word.
 */
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

  // Clear the strided scratch table every frame (shared per-frame housekeeping for this attract step).
  clearStridedTable(m);

  // Blank one 28-cell row at the fill cursor, then store the cursor advanced by a full row (+32) so the
  // next tick clears the following row.
  const cursor = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, cursor, BLANK_TILE, ROW_CELLS);
  mem16[VRAM_WRITE_PTR] = cursor + ROW_STRIDE;

  // Dwell countdown: keep waiting until it reaches zero.
  // While the dwell still runs the step is not finished, so return and blank another row next frame.
  const dwell = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = dwell;
  if (dwell !== 0) return;

  // Dwell expired — reset for the next attract phase:
  // Step the top-level sequence to the next state (SEQUENCE_STATE is 0x400a).
  mem8[SEQUENCE_STATE]++;
  fillMemoryBlock(m, SPRITE_SOURCE_OBJ_BASE, 0, 0);  // count 0 -> full 256-byte clear
  // Wipe the 64-byte sprite staging shadow.
  fillMemoryBlock(m, SPRITE_SHADOW_BASE, 0, 64);
  mem8[loc_4008] = 64; // re-arm the sub-timer tier
  mem8[loc_4009] = 4;  // re-arm the dwell tier
  // Reseed the stride-2 OBJRAM shadow from its ROM template.
  seedObjectShadowFromRom(m);
  return enqueueCommandWord(m, 6 << 8); // queue command word 6
}
