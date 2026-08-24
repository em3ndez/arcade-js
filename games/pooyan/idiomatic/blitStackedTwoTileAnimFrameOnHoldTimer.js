// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { TWOTILE_ANIM_HOLD, TWOTILE_ANIM_PHASE, TWOTILE_SRC_TABLE, BLIT_SCREEN_ANCHOR } from "./names.js";
/**
 * Frame-gated two-tile blitter. A hold countdown gates the work: while it is non-zero it counts down
 * and returns. On expiry it reloads the countdown, advances a phase counter, and uses the phase's
 * low bit to pick one of two adjacent four-byte source patterns. That pattern is stamped as a 2x2
 * block at the screen anchor and stamped again two rows higher.
 *
 * LIVE-OUT: memory only (the reloaded countdown, the advanced phase, and the eight painted tiles);
 * no register survives for a reader.
 */
const RELOAD_HOLD = 0x0c;
const SECOND_BLOCK_UP = 0x60; // subtracted from the first block's advanced pointer -> two rows above

export function blitStackedTwoTileAnimFrameOnHoldTimer(m) {
  const { mem8 } = m;

  if (mem8[TWOTILE_ANIM_HOLD] !== 0) {
    mem8[TWOTILE_ANIM_HOLD] = mem8[TWOTILE_ANIM_HOLD] - 1; // still holding
    return;
  }

  mem8[TWOTILE_ANIM_HOLD] = RELOAD_HOLD;
  mem8[TWOTILE_ANIM_PHASE] = mem8[TWOTILE_ANIM_PHASE] + 1;
  const src = (mem8[TWOTILE_ANIM_PHASE] & 0x01) === 0
    ? TWOTILE_SRC_TABLE
    : TWOTILE_SRC_TABLE + 0x04;

  const advanced = blit2x2TileBlock(m, BLIT_SCREEN_ANCHOR, src);
  blit2x2TileBlock(m, u16(advanced - SECOND_BLOCK_UP), src);
}
