// SPDX-License-Identifier: GPL-3.0-only
//
// blankVramRowsThenDriveStartLamps (ROM 0x0443) -- [seen]
//
// WHAT IT IS
//   runStartScreenAndLaunchGame's sequence-state index 2 (the credit-inserted "press start" screen,
//   GAME_STATE = 2). Each frame it wipes two more tile rows to blank, steps the VRAM write cursor past
//   them, and ticks a dwell tier; while rows remain it just returns. On the final row it advances the
//   sequence, resets the flip/direction cells, queues two redraw commands, and lights the start lamps.
//
// ROLE IN THE MACHINE
//   This is the progressive screen-clear step of the press-start dispatch (slots:
//   resetObjectRamAndAdvanceSequence -> holdStartLampsThenAdvanceSequence -> THIS ->
//   driveStartButtonLamps). It blanks the attract artwork two rows at a time so the board is clean
//   before play. VRAM_WRITE_PTR (0x400b) is the 16-bit tilemap fill cursor; loc_4009 is the dwell tier
//   of the sequence cascade (loc_4008 / loc_4009 / SEQUENCE_STATE 0x400a), here counting the remaining
//   row-pairs. On completion it clears the screen-flip latches FLIP_SCREEN_X/Y (0x7006/0x7007) and the
//   orientation flag loc_4018, then enqueues a channel-7 HUD-field redraw (arg 2) and a channel-6
//   message-column command (arg 1) for the display-list drain, and drives the credit-gated start lamps.
//
// LIVE-OUT: VRAM_WRITE_PTR advanced; loc_4009 decremented. On the last row: SEQUENCE_STATE++,
//   FLIP_SCREEN_X/Y=0, loc_4018=0, two command words queued, start lamps updated.
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

export function blankVramRowsThenDriveStartLamps(m) {
  const { mem8, mem16 } = m;

  // Blank two 28-cell tile rows through the shared fill cursor. Each row spans RUN cells; the GAP
  // step skips the 4 off-screen cells between one row's end and the next row's start (a 32-cell
  // tilemap pitch = 28 visible + 4 gap). The advanced cursor is written back so the next frame
  // continues where this one left off.
  let ptr = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, ptr, FILL_TILE, RUN);
  ptr = u16(ptr + RUN + GAP);
  fillMemoryBlock(m, ptr, FILL_TILE, RUN);
  ptr = u16(ptr + RUN + GAP);
  mem16[VRAM_WRITE_PTR] = ptr;

  // Count down the dwell tier: one tick per frame = one row-pair remaining.
  mem8[loc_4009] = mem8[loc_4009] - 1; // store truncates: a 0 tier wraps to 255 and keeps counting
  if (mem8[loc_4009] !== 0) return; // more rows remain

  // Last row done: advance the sequence to the next start-screen sub-state (the carry into 0x400a).
  mem8[SEQUENCE_STATE]++;
  // Reset the screen-flip hardware latches and the orientation flag so play starts un-flipped.
  mem8[FLIP_SCREEN_X] = 0; // screen-flip latches off
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;

  // Queue the two deferred redraws for the display-list drain: channel 7 = HUD field (arg 2),
  // channel 6 = message column (arg 1). Word format is (channel << 8) | param.
  enqueueCommandWord(m, (7 << 8) | 2);
  enqueueCommandWord(m, (6 << 8) | 1);

  // Light the start-button lamps from the credit count (gated on FRAME_COUNTER bit 5).
  driveStartButtonLamps(m);
}
