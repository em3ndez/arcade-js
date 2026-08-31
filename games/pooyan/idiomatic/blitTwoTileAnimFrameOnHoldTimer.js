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
 * blitTwoTileAnimFrameOnHoldTimer — frame-gated two-tile character-block animator.
 *
 * ROM 0x2563-0x25a5. Grounding: [seen].
 *
 * WHAT IT IS: one per-frame tick of a small cycling two-tile decoration (of the "READY"-style
 * two-block kind). Each frame the routine decides whether enough time has passed to advance the
 * decoration to its next picture, and on an advance it stamps that picture into video RAM as two
 * stacked 2x2 character squares. Video RAM is a grid of 8x8 character cells; a 2x2 square is a
 * four-cell block, and the decoration is two such squares in the same column.
 *
 * ROLE IN THE MACHINE: this is a hold-timer animator. Two bytes of work RAM drive it — a hold
 * countdown (TWOTILE_ANIM_HOLD, 0x8f06) that spaces the frames out in time, and a phase byte
 * (TWOTILE_ANIM_PHASE, 0x8f07) that counts which picture is showing. Which picture appears is
 * chosen from the parity of the phase and the parity of the round number (ROUND_COUNTER,
 * 0x8907), so the two-frame cycle can look different on odd and even rounds. A separate
 * play-mode state selector (PLAY_MODE_LATCH, 0x8f50) can freeze the whole thing.
 *
 * THE PICTURE: four candidate 4-byte source blocks sit consecutively in ROM at TWOTILE_SRC_TABLE
 * (0x2744, stride 4). Round parity picks the pair, phase parity picks one block of that pair.
 * Round parity also chooses the on-screen anchor — one of two video-RAM cells. The chosen block
 * is stamped twice: once at the anchor and once three rows higher up the same column, giving the
 * stacked two-tile look.
 *
 * LIVE-OUT: none in registers — the caller consumes no result. Every lasting effect is in memory:
 * the reloaded hold countdown and the bumped phase byte, and — on an advance frame only — the
 * eight video-RAM cells of the two 2x2 squares.
 */

// Frames a single picture is held on screen before the animator advances to the next one. The
// hold countdown (TWOTILE_ANIM_HOLD) is reloaded with this value each time it drains to zero.
const HOLD_RELOAD = 0x0c;
// Distance in video-RAM cells from the lower square's lower-left cell up to the upper square's
// anchor. The video-RAM row pitch is 0x20 cells, so 0x60 is exactly three rows up the column.
const SQUARE_GAP = 0x60;

export function blitTwoTileAnimFrameOnHoldTimer(m) {
  const { mem8 } = m;

  // GATE: the play-mode state selector (0x8f50) is set by the gameplay handlers while certain
  // modes are running. Any non-zero value suspends this decoration entirely for the frame — no
  // countdown is spent, no phase advances, nothing is painted.
  if (mem8[PLAY_MODE_LATCH] !== 0) return; // suspended while the play-mode latch is busy

  // HOLD COUNTDOWN: the hold timer (0x8f06) is what spaces the animation out in real time. While
  // it is still counting, spend a single frame of it and leave the on-screen picture untouched —
  // the large majority of frames take this early return and draw nothing.
  if (mem8[TWOTILE_ANIM_HOLD] !== 0) {
    mem8[TWOTILE_ANIM_HOLD] = mem8[TWOTILE_ANIM_HOLD] - 1; // burn one frame of the current hold
    return;
  }
  // EXPIRY -> ADVANCE: the hold has reached zero, so this frame advances the animation. Reload
  // the hold with its full interval (0x0c frames) and bump the phase byte (0x8f07). The phase
  // counts pictures; only its low bit is read below, so in effect each advance flips the frame.
  mem8[TWOTILE_ANIM_HOLD] = HOLD_RELOAD;
  mem8[TWOTILE_ANIM_PHASE] = mem8[TWOTILE_ANIM_PHASE] + 1; // advance the phase

  // SELECT THE PICTURE: two parity bits decide what to draw. Round parity (ROUND_COUNTER 0x8907
  // bit0) tells odd rounds apart from even ones; phase parity (0x8f07 bit0) is the two-frame
  // blink of the decoration itself.
  const roundOdd = mem8[ROUND_COUNTER] & 0x01;
  const phaseOdd = mem8[TWOTILE_ANIM_PHASE] & 0x01;
  // SOURCE BLOCK: four 4-byte blocks sit consecutively at TWOTILE_SRC_TABLE (0x2744). Round
  // parity selects the pair (offset 0 or 8 bytes), phase parity selects within the pair (offset
  // 0 or 4):  even round -> 0x2744 / 0x2748,  odd round -> 0x274c / 0x2750.
  const src = TWOTILE_SRC_TABLE + 4 * ((roundOdd ? 2 : 0) + (phaseOdd ? 1 : 0));
  // SCREEN ANCHOR: round parity also chooses where on screen the pair lands. Odd rounds anchor on
  // the ready-sprite tile cell (0x87bb); even rounds anchor on the alternate cell (0x84bb).
  const anchor = roundOdd ? READY_SPRITE_TILE_VRAM : TWOTILE_ANIM_VRAM_ALT;

  // PAINT TWO STACKED SQUARES: stamp the chosen 4-byte block as a 2x2 character square at the
  // anchor. The block primitive hands back that square's lower-left cell, which is the foothold
  // for walking up the column: stepping up by SQUARE_GAP (three rows) gives the upper square's
  // anchor, stamped from the same source block to complete the stacked two-tile figure. u16 keeps
  // the stepped-back pointer inside the 16-bit address space.
  const lowerLeft = blit2x2TileBlock(m, anchor, src); // lower square; its lower-left cell returned
  blit2x2TileBlock(m, u16(lowerLeft - SQUARE_GAP), src); // upper square, same source, three rows up
}
