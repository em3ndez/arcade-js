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
 * advanceAttractAnimationAndRepaint — take one step of the 4-phase attract-screen animation
 * and repaint the two on-screen tile blocks it drives.
 *
 * ROM 0x0a28. Grounding: [seen].
 *
 * WHAT IT IS. On the attract / idle screen the machine shows a small animated decoration built
 * from a 2x2 square of background tiles that cycles through four distinct frames of artwork. Two
 * identical copies of that square appear on the display. This routine performs one animation
 * step: it re-arms the animation countdown, advances the phase, selects this phase's tile
 * artwork, and stamps that artwork into both copies.
 *
 * ROLE IN THE MACHINE. The animation is paced by a countdown rather than run every video frame.
 * A separate frame counter is decremented once per displayed frame; when it winds down to its
 * wrap this routine is run to take the next animation step and reload the countdown. So one call
 * here is one animation tick, and the reload value sets how many video frames separate ticks.
 *
 * LIVE-OUT: memory only.
 *   - ANIM_FRAME_COUNTER (0x8d41) reseeded to 0x0a — the animation-tick period.
 *   - ACTIVE_ENEMY_COUNT (0x8d40) incremented — its low two bits are the animation phase.
 *   - the two 2x2 tile blocks at ANIM_TILE_BLOCK_TOP (0x866a) and ANIM_TILE_BLOCK_BOTTOM
 *     (0x86aa) repainted with this phase's artwork.
 * Callers invoke this only on the countdown wrap and never read a register back, so the
 * contract is purely RAM.
 */
export function advanceAttractAnimationAndRepaint(m) {
  const { mem8 } = m;

  // Re-arm the animation-tick countdown. ANIM_FRAME_COUNTER (0x8d41) is reloaded to 0x0a; it is
  // decremented once per displayed frame elsewhere, so this reload spaces successive animation
  // steps 0x0a video frames apart. Reseeding it here is what makes each call one animation tick.
  mem8[ANIM_FRAME_COUNTER] = 0x0a;

  // Advance the animation phase. ACTIVE_ENEMY_COUNT (0x8d40) doubles as the attract animation's
  // phase counter — on the attract screen it simply ramps upward. Read the value BEFORE bumping
  // it: the pre-bump value picks the frame to draw now, while the stored value leaves the next
  // phase ready for the next tick. Only the low two bits are used, so the phase walks
  // 0,1,2,3,0,1,... as the counter climbs.
  const counter = mem8[ACTIVE_ENEMY_COUNT];
  mem8[ACTIVE_ENEMY_COUNT] = counter + 1; // advance; the phase is the pre-bump value
  const phase = counter & 0x03;

  // Look up this phase's tile artwork. ANIM_FRAME_WORD_TABLE (0x26f6) is a ROM array of four
  // 16-bit little-endian entries, one per phase, each pointing at a four-byte run of tile codes.
  // Index by phase*2 (two bytes per entry) and assemble the low byte with the high byte shifted
  // up to form the source pointer. Pure ROM read — no RAM is touched here.
  const entry = ANIM_FRAME_WORD_TABLE + phase * 2;
  const src = mem8[entry] | (mem8[entry + 1] << 8);

  // Stamp this phase's 2x2 artwork into both on-screen copies. The background tilemap is 0x20
  // tile codes wide, so each block is a square of four cells anchored at its top-left address.
  // The same source run fills ANIM_TILE_BLOCK_TOP (0x866a) first, then the identical block at
  // ANIM_TILE_BLOCK_BOTTOM (0x86aa); as the phase advances, these cells cycle through the four
  // frames of the animation.
  paintTileBlock2x2(m, ANIM_TILE_BLOCK_TOP, src);
  paintTileBlock2x2(m, ANIM_TILE_BLOCK_BOTTOM, src);
}
