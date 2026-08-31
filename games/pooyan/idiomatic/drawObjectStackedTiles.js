// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_CHAR_TABLE_ROW0, OBJECT_CHAR_TABLE_ROW1, OBJECT_DRAWN_FLAG } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { clearAndReseedObjectSlot } from "./clearAndReseedObjectSlot.js";
import { paintTileBlock2x2Above } from "./paintTileBlock2x2Above.js";

/**
 * drawObjectStackedTiles — the "draw" step of the object cluster's little three-state machine.
 * ROM 0x7790. Grounding: [seen].
 *
 * WHAT IT IS
 *   Some of Pooyan's on-screen actors are not drawn as hardware sprites; they are stamped
 *   directly into the tilemap as a tall figure built from two stacked 2x2 tile blocks. Each
 *   such object owns a record (base held in IX) that carries a small state index. The object
 *   cluster runs that record through three states in turn: state 0 arms a fresh object
 *   (armObjectFromSpawnRing), state 1 moves it (moveObject), and state 2 — this routine —
 *   is reached once the object has settled and is ready to be painted.
 *
 * ROLE IN THE MACHINE
 *   On every frame while the object sits in state 2 this routine steps the object's animation
 *   and counts down a hold timer. Nothing is painted until that timer lapses; then it draws the
 *   figure (two stacked blocks), marks that at least one object has been drawn this pass, and
 *   immediately hands the record on to the clear/reseed step (clearAndReseedObjectSlot) that
 *   tears the finished object down. So a single visit either "waits one more frame" or "draws
 *   once and finishes".
 *
 * THE RECORD FIELDS IT READS (offsets from the record base)
 *   +0x11  frame hold timer  — ticked down each frame; the figure is drawn only when it hits 0
 *   +0x13  sprite index      — selects which char-table word (which tile pattern) to stamp
 *   +0x15  screen pointer lo  ) little-endian tilemap address where the lower block is anchored
 *   +0x16  screen pointer hi  )
 *
 * LIVE-OUT (what it leaves behind in memory)
 *   - two 2x2 tile blocks stamped into the tilemap (the lower block at the record's screen
 *     pointer, the upper block 0x400 above it) — only on the frame the hold timer lapses;
 *   - OBJECT_DRAWN_FLAG (0x8d58) raised to 1 the first time an object is drawn this pass;
 *   - the record's hold timer (+0x11) decremented;
 *   - the object record cleared and reseeded by the tail step.
 */

// Record-field offsets from the object record base (IX).
const OFF_TIMER = 0x11; // +0x11: per-frame hold timer — while nonzero the figure is not drawn yet
const OFF_SPRITE = 0x13; // +0x13: sprite/animation index that selects the char-table word to stamp
const OFF_PTR_LO = 0x15; // +0x15: low byte of the tilemap anchor for the lower 2x2 block
const OFF_PTR_HI = 0x16; // +0x16: high byte of that tilemap anchor
const ROW_ABOVE = 0x400; // video-RAM distance from the lower block up to the upper block (one tile-row group up on screen)

export function drawObjectStackedTiles(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the object's own animation sequence (frame-hold countdown + script walk) for this
  // record. This runs every frame the object is in the draw state, whether or not the figure
  // is painted below, so the animation keeps advancing while the hold timer counts down.
  advanceObjectAnimationFrame(m, rec);

  // Tick the record's frame hold timer (+0x11) down by one. If it has not yet reached zero the
  // object is still holding on its current frame: return immediately and paint nothing this frame.
  mem8[rec + OFF_TIMER] = u8(mem8[rec + OFF_TIMER] - 1);
  if (mem8[rec + OFF_TIMER] !== 0) return; // hold timer still running -> draw nothing this frame

  // --- Hold timer lapsed: draw the figure as two stacked 2x2 tile blocks. ---

  // The sprite index (+0x13) chooses which tile pattern to stamp; the screen pointer
  // (+0x15/+0x16) is the tilemap address where the lower block is anchored.
  const sprite = mem8[rec + OFF_SPRITE];
  const screenPtr = mem8[rec + OFF_PTR_LO] | (mem8[rec + OFF_PTR_HI] << 8);

  // Lower block: look up the char-data word for this sprite in the ROM lower-row table
  // (OBJECT_CHAR_TABLE_ROW0 at 0x7821) and stamp a 2x2 tile block at the screen pointer.
  paintTileBlock2x2Above(m, screenPtr, fetchWordFromTableIndex(m, sprite, OBJECT_CHAR_TABLE_ROW0)); // lower row

  // Upper block: the same sprite index into the ROM upper-row table (OBJECT_CHAR_TABLE_ROW1 at
  // 0x7841), stamped 0x400 above the lower anchor so the two 2x2 blocks stack into one taller
  // figure on screen. u16 wraps the pointer subtraction to a 16-bit tilemap address.
  paintTileBlock2x2Above(m, u16(screenPtr - ROW_ABOVE), fetchWordFromTableIndex(m, sprite, OBJECT_CHAR_TABLE_ROW1)); // above

  // Raise the shared "an object was drawn" flag (0x8d58) the first time it is seen clear this
  // pass. It is a one-shot latch — later objects that draw in the same pass leave it as-is.
  if (mem8[OBJECT_DRAWN_FLAG] === 0) mem8[OBJECT_DRAWN_FLAG] = 1;

  // The figure has been painted, so this object is done: hand the record straight on to the
  // clear/reseed step, which tears the slot down and (behind a colour-RAM integrity check)
  // reseeds it. Its result is this routine's result.
  return clearAndReseedObjectSlot(m, rec); // continue into the record-clear step
}
