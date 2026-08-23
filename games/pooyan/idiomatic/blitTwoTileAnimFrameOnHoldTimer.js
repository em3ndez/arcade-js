// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  PLAY_MODE_LATCH,
  ROUND_COUNTER,
  TWOTILE_ANIM_HOLD,
  TWOTILE_ANIM_PHASE,
  TWOTILE_SRC_TABLE,
  READY_SPRITE_TILE_VRAM,
  TWOTILE_ANIM_VRAM_ALT,
} from "./names.js";
/**
 * blitTwoTileAnimFrameOnHoldTimer — frame-gated two-tile animation. While the play-mode latch is busy it does
 * nothing. Otherwise it runs a hold countdown: each tick decrements it and returns, and on
 * expiry it reloads the hold and advances the phase. The round parity and the phase parity
 * then select one of four 4-byte source blocks (stride 4) and one of two video anchors, and
 * that block is stamped as two 2x2 squares, the second stacked above the first.
 *
 * LIVE-OUT: none — the caller consumes no register result; all effect is in memory.
 */

const HOLD_RELOAD = 0x0c; // frames the current phase is held before advancing
const SQUARE_GAP = 0x60; // step from the first square's lower-left up to the second square

export function blitTwoTileAnimFrameOnHoldTimer(m) {
  const { mem8 } = m;

  if (mem8[PLAY_MODE_LATCH] !== 0) return; // suspended while the play-mode latch is busy

  if (mem8[TWOTILE_ANIM_HOLD] !== 0) {
    mem8[TWOTILE_ANIM_HOLD] = mem8[TWOTILE_ANIM_HOLD] - 1; // still holding this phase
    return;
  }
  mem8[TWOTILE_ANIM_HOLD] = HOLD_RELOAD;
  mem8[TWOTILE_ANIM_PHASE] = mem8[TWOTILE_ANIM_PHASE] + 1; // advance the phase

  const roundOdd = mem8[ROUND_COUNTER] & 0x01;
  const phaseOdd = mem8[TWOTILE_ANIM_PHASE] & 0x01;
  const src = TWOTILE_SRC_TABLE + 4 * ((roundOdd ? 2 : 0) + (phaseOdd ? 1 : 0));
  const anchor = roundOdd ? READY_SPRITE_TILE_VRAM : TWOTILE_ANIM_VRAM_ALT;

  const lowerLeft = blit2x2TileBlock(m, anchor, src); // first square; returns its lower-left cell
  blit2x2TileBlock(m, u16(lowerLeft - SQUARE_GAP), src); // second square, same source, three rows up
}
