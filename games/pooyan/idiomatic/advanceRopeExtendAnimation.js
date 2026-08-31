// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  ROPE_EXTEND_TIMER,
  ROPE_EXTEND_FRAME_INDEX,
  ROPE_EXTEND_STATE,
  ROPE_EXTEND_INDEX,
  ROPE_COLUMN_VRAM_PTR,
  ROPE_TILE_BLOCK_TABLE,
} from "./names.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";

/**
 * advanceRopeExtendAnimation — rope-extend blit driver (ROPE_EXTEND_STATE == 1).
 *
 * Counts the hold timer down and returns while it runs. On expiry it reloads the hold to 8 and,
 * once the frame index has reached 8, resets the index + state and re-arms the next rope cell (a
 * computed 0x8f-page byte keyed on ROPE_EXTEND_INDEX). Otherwise it looks up this frame's tile
 * block and blits it at the rope column, then bumps the frame index.
 *
 * LIVE-OUT: none — a void dispatched handler; all effect is in memory.
 */

const HOLD_RELOAD = 0x08;
const FRAME_LIMIT = 0x08;

export function advanceRopeExtendAnimation(m) {
  const { mem8, mem16 } = m;

  if (mem8[ROPE_EXTEND_TIMER] !== 0) {
    mem8[ROPE_EXTEND_TIMER] = u8(mem8[ROPE_EXTEND_TIMER] - 1); // hold still running
    return;
  }
  mem8[ROPE_EXTEND_TIMER] = HOLD_RELOAD;

  const frameIndex = mem8[ROPE_EXTEND_FRAME_INDEX];
  if (frameIndex === FRAME_LIMIT) {
    mem8[ROPE_EXTEND_FRAME_INDEX] = 0; // sequence done: reset index + state
    mem8[ROPE_EXTEND_STATE] = 0;
    const ropeIndex = mem8[ROPE_EXTEND_INDEX];
    // re-arm cell = page 0x8f | ((0x1b + ropeIndex) & 0xff); 0x1b is ROPE_EXTEND_FRAME_INDEX's low byte
    const rearm = (ROPE_EXTEND_FRAME_INDEX & ~0xff) | ((ROPE_EXTEND_FRAME_INDEX + ropeIndex) & 0xff);
    mem8[rearm] = 0x01;
    return;
  }

  const block = fetchWordFromTableIndex(m, frameIndex, ROPE_TILE_BLOCK_TABLE); // tile-block word for this frame
  blit2x2TileBlock(m, mem16[ROPE_COLUMN_VRAM_PTR], block);
  mem8[ROPE_EXTEND_FRAME_INDEX] = u8(mem8[ROPE_EXTEND_FRAME_INDEX] + 1);
}
