// SPDX-License-Identifier: GPL-3.0-only
import {
  ANIM_FRAME_COUNTER,
  ACTIVE_ENEMY_COUNT,
  ANIM_FRAME_WORD_TABLE,
  ANIM_TILE_BLOCK_TOP,
  ANIM_TILE_BLOCK_BOTTOM,
} from "./names.js";
import { paintTileBlock2x2 } from "./paintTileBlock2x2.js";

/**
 * Advance the 4-phase attract animation and repaint its tile block.
 *
 * Reseed the frame-countdown, bump the phase counter, and select this phase's 2x2 tile
 * source from the frame-word table (a plain little-endian lookup with no RAM effect).
 * Stamp that same source into the block's top and bottom halves.
 *
 * LIVE-OUT: memory only. Callers invoke this only on the countdown wrap and never read a
 * register back, so the contract is RAM.
 */
export function loc_0a28(m) {
  const { mem8 } = m;

  mem8[ANIM_FRAME_COUNTER] = 0x0a;

  const counter = mem8[ACTIVE_ENEMY_COUNT];
  mem8[ACTIVE_ENEMY_COUNT] = counter + 1; // advance; the phase is the pre-bump value
  const phase = counter & 0x03;

  const entry = ANIM_FRAME_WORD_TABLE + phase * 2;
  const src = mem8[entry] | (mem8[entry + 1] << 8);

  paintTileBlock2x2(m, ANIM_TILE_BLOCK_TOP, src);
  paintTileBlock2x2(m, ANIM_TILE_BLOCK_BOTTOM, src);
}
