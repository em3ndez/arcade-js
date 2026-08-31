// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { TWOTILE_ANIM_HOLD, TWOTILE_ANIM_PHASE, TWOTILE_SRC_TABLE, BLIT_SCREEN_ANCHOR } from "./names.js";
/**
 * blitStackedTwoTileAnimFrameOnHoldTimer — one tick of a small, self-timed two-frame tile
 * animation.
 *
 * WHAT IT IS: video RAM is a grid of 8x8 character cells, one byte per cell, with the cell
 * directly below any cell one row-pitch (0x20 bytes) further along. This routine repaints a
 * little picture that lives in that grid — a 2-cell-wide, 4-cell-tall image built out of two
 * stacked 2x2 character blocks — and cycles it between two frames on a fixed cadence. It is
 * meant to be called once per video frame; most calls do nothing but count down, and every
 * twelfth call flips the picture to its other frame and stamps it fresh.
 *
 * ROLE IN THE MACHINE: this is one of the two hold-timer tile animators that drive the small
 * blinking/cycling two-tile graphics on screen (the "READY"-style flashers). It is the simpler
 * of the pair — it always draws at one fixed screen position and only ever chooses between two
 * adjacent source patterns, whereas the sibling animator also keys its source and anchor off
 * the round. The animation it plays is deliberately slow: the same frame is held for a dozen
 * video frames before the swap, giving a steady two-state blink rather than a fast flicker.
 *
 * ROM 0x6b13. Grounding: [seen].
 *
 * LIVE-OUT: memory only — the reloaded hold countdown at TWOTILE_ANIM_HOLD (0x8f06), the
 * advanced phase byte at TWOTILE_ANIM_PHASE (0x8f07), and the eight character cells painted by
 * the two 2x2 stamps. No register value is meant to survive for a caller to read.
 */

// Frames the current picture is held before it is allowed to flip to the other frame. Reloaded
// into the hold countdown each time it hits zero, so the animation swaps once every 0x0c frames.
const RELOAD_HOLD = 0x0c;
// The two stacked blocks sit contiguously. blit2x2TileBlock hands back the anchor advanced by
// one row-pitch (the block's bottom-left cell); subtracting 0x60 (three row-pitches) from that
// nets two row-pitches (0x40) above the anchor — the top-left of the upper block, which lands
// directly on top of the lower block with no gap between them.
const SECOND_BLOCK_UP = 0x60; // subtracted from the first block's advanced pointer -> two rows above

export function blitStackedTwoTileAnimFrameOnHoldTimer(m) {
  const { mem8 } = m;

  // Hold gate. While the countdown at TWOTILE_ANIM_HOLD (0x8f06) is still running, the picture
  // stays put: tick one frame off it and leave without touching the phase or the screen. This is
  // the common path — the animation is idle between swaps.
  if (mem8[TWOTILE_ANIM_HOLD] !== 0) {
    mem8[TWOTILE_ANIM_HOLD] = mem8[TWOTILE_ANIM_HOLD] - 1; // still holding
    return;
  }

  // Swap frame. The countdown has expired, so re-arm it to RELOAD_HOLD (0x0c) for the next hold,
  // then advance the phase byte at TWOTILE_ANIM_PHASE (0x8f07) by one. The phase's low bit is the
  // frame selector: even picks the first 4-byte source block at TWOTILE_SRC_TABLE (0x2744), odd
  // picks the adjacent block four bytes further on (0x2748). Because the phase increments every
  // swap, the two frames alternate.
  mem8[TWOTILE_ANIM_HOLD] = RELOAD_HOLD;
  mem8[TWOTILE_ANIM_PHASE] = mem8[TWOTILE_ANIM_PHASE] + 1;
  const src = (mem8[TWOTILE_ANIM_PHASE] & 0x01) === 0
    ? TWOTILE_SRC_TABLE
    : TWOTILE_SRC_TABLE + 0x04;

  // Paint the stacked picture. Stamp the selected pattern as a 2x2 block at the fixed screen
  // anchor BLIT_SCREEN_ANCHOR (0x84b4); that stamp reports back the anchor advanced one row down.
  // Step that pointer up by SECOND_BLOCK_UP and stamp the same pattern again to lay the upper 2x2
  // block directly on top, completing the 2x4 image. Both blocks show the current frame.
  const advanced = blit2x2TileBlock(m, BLIT_SCREEN_ANCHOR, src);
  blit2x2TileBlock(m, u16(advanced - SECOND_BLOCK_UP), src);
}
