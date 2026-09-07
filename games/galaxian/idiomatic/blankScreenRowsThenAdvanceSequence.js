// SPDX-License-Identifier: GPL-3.0-only

/**
 * blankScreenRowsThenAdvanceSequence (ROM 0x0583) — play sub-state 1: progressive screen clear.
 *
 * WHAT IT IS
 *   One tick of a multi-frame screen wipe. Each call blanks a 32-cell VRAM row at the running fill cursor,
 *   steps the cursor to the next row, and counts down a phase counter; only on the final phase does it
 *   advance the sequence state machine and reseed the sprite (OBJRAM) shadow.
 *
 * ROLE IN THE MACHINE
 *   Sub-state index 1 of both play-state tables — runPlayerOnePlayFrame (game-state 3) and
 *   runPlayerTwoPlayFrame (game-state 4). VRAM_WRITE_PTR (0x400b) is the 16-bit VRAM fill cursor; the wipe
 *   walks it a row (32 cells) at a time, writing the blank tile (code 16). loc_4009 is the dwell/phase tier
 *   of the sequence timer cascade (mechanisms.md "dwell-timer cascade"): decrementing it to zero is what
 *   permits the state to advance. On the last phase it tails to advanceSequenceStateAndReseedObjectShadow
 *   (0x0593), which bumps SEQUENCE_STATE (0x400a — the byte just above loc_4009 in page 0x40) and reseeds
 *   the stride-2 OBJRAM shadow from the ROM template.
 *
 * ROM 0x0583.  Grounding: [seen].
 *
 * LIVE-OUT: a blanked 32-cell VRAM row; VRAM_WRITE_PTR advanced +32; loc_4009 decremented; and, on the
 *   final phase, SEQUENCE_STATE advanced and the OBJRAM shadow reseeded.
 */
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { advanceSequenceStateAndReseedObjectShadow } from "./advanceSequenceStateAndReseedObjectShadow.js";
import { VRAM_WRITE_PTR, loc_4009 } from "./names.js";

const BLANK_TILE = 16;
const ROW_CELLS = 32;

export function blankScreenRowsThenAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  // Blank one row: fill 32 cells with the blank tile at the current cursor, then store the cursor advanced
  // by one row (+32) back to VRAM_WRITE_PTR so the next tick clears the next row.
  const cursor = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, cursor, BLANK_TILE, ROW_CELLS);
  mem16[VRAM_WRITE_PTR] = cursor + ROW_CELLS;

  // Phase countdown: keep going until it reaches zero.
  // While phases remain the wipe is still in progress, so return and blank another row next frame.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  // Last phase: advance SEQUENCE_STATE (the byte above loc_4009) and reseed the OBJRAM shadow from ROM.
  return advanceSequenceStateAndReseedObjectShadow(m, loc_4009);
}
