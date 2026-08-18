// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyDiveAnimFrame — copy one dive-animation frame (a two-byte tile pair) from a frame table
 * into a VRAM column, then advance for the next call: the frame index steps by two bytes and the
 * column offset by a full row. When the frame index passes the last frame the dive cycle is finished,
 * so the busy latch and every frame cell are cleared and the next dive starts fresh. The table base is
 * the live-in (a register in the translated form). LIVE-OUT: memory-only.
 */
import {
  TWOPLAYER_FRAME_CELL_814E,
  TWOPLAYER_FRAME_CELL_8145,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
  SPRITE_FRAME_BUSY_LATCH1,
  FROG_ANIM_COLUMN_VRAM,
} from "./names.js";

const FRAME_INDEX_STEP = 2;
const FRAME_INDEX_LIMIT = 0x10; // past the last frame -> end the cycle
const COLUMN_STRIDE = 0x20; // dest advances a full VRAM row each call

export function copyDiveAnimFrame(m, tableBase = m.regs.hl) {
  const { mem8 } = m;

  const frameIndex = mem8[TWOPLAYER_FRAME_CELL_814E];
  const nextFrameIndex = (frameIndex + FRAME_INDEX_STEP) & 0xff;
  mem8[TWOPLAYER_FRAME_CELL_814E] = nextFrameIndex;

  const column = mem8[TWOPLAYER_FRAME_CELL_8145];
  const src = tableBase + frameIndex;
  const dest = FROG_ANIM_COLUMN_VRAM + column;
  mem8[dest] = mem8[src];
  mem8[dest + 1] = mem8[src + 1];
  mem8[TWOPLAYER_FRAME_CELL_8145] = column + COLUMN_STRIDE;

  if (nextFrameIndex < FRAME_INDEX_LIMIT) return; // more frames to come this cycle
  // Cycle complete: clear the busy latch and all four frame cells so the next dive re-seeds.
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 0;
  mem8[TWOPLAYER_FRAME_CELL_814E] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8145] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8146] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8147] = 0;
}
