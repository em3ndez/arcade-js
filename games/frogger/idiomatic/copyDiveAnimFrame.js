// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyDiveAnimFrame  —  ROM 0x281b  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The blitter for the river diver's *dive* animation — the descending tile column that paints its way
 *   down the screen while the two-pair figure dives. Each call emits exactly ONE frame: it copies a
 *   single two-byte tile PAIR out of a ROM frame table into the next cell of a VRAM column, then walks
 *   the cursor forward so the following call paints the pair one row below it. A full dive cycle is eight
 *   frames; the eighth call tears the cycle down so the next dive re-seeds from scratch.
 *
 * WHERE IT SITS
 *   The emit end of the dive pacer. The per-frame surface-timer stepDiveSurfaceTimer (0x27fe) counts a
 *   period down and, once per period, emits one dive frame: on the ODD gate phase it calls this routine
 *   directly with the main tile table FROG_ANIM_TILE_PAIR_SRC (0x1413); on the EVEN phase it enters via
 *   selectDiveVariantFrame (0x286d), which points the copy at the alternate table FROG_ANIM_ARM0_SRC_BASE
 *   (0x1403) and tail-calls here. Either way the chosen table base arrives as the live-in (register HL in
 *   the translated form), defaulted from m.regs.hl.
 *
 * THE INTERLOCK
 *   The dive animation and the on-screen figure flip share the busy latch SPRITE_FRAME_BUSY_LATCH1
 *   (0x814f). While a dive cycle is armed the latch is set, and the figure animator animateTwoPairFigure
 *   (0x291d) bails on it each frame. This routine clearing the latch at the end of the eighth frame is
 *   exactly what re-enables the figure flip — so tearing the cycle down is a hand-back, not just cleanup.
 *
 * LIVE-OUT
 *   Memory only. It writes two VRAM cells and advances two cursor cells every call, and at cycle end it
 *   clears the busy latch plus four frame cells. It returns nothing and leaves no register the caller reads.
 */
import {
  TWOPLAYER_FRAME_CELL_814E,
  TWOPLAYER_FRAME_CELL_8145,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
  SPRITE_FRAME_BUSY_LATCH1,
  FROG_ANIM_COLUMN_VRAM,
} from "./names.js";

// The frame index is a BYTE offset into the ROM table that steps by one whole tile pair (2 bytes) each
// frame, so across a cycle 0x814e reads 0, 2, 4, 6, … 0xe.
const FRAME_INDEX_STEP = 2;

// Eight frames make one full dive cycle: 8 pairs × 2 bytes = 0x10. Once the stepped index reaches 0x10 it
// has walked past the last frame, so the cycle is over and the routine tears it down.
const FRAME_INDEX_LIMIT = 0x10; // past the last frame -> end the cycle

// The destination column walks straight DOWN the screen: one screen row is 0x20 (32) tile cells, so
// adding 0x20 to the column offset drops the next tile pair a full row lower, drawing a descending column.
const COLUMN_STRIDE = 0x20; // dest advances a full VRAM row each call

export function copyDiveAnimFrame(m, tableBase = m.regs.hl) {
  const { mem8 } = m;

  // ── Step the frame cursor ────────────────────────────────────────────────────────────
  // TWOPLAYER_FRAME_CELL_814E (0x814e) is the dive cycle's byte index into the ROM frame table. Read the
  // current frame, advance it by one tile pair (+2, masked to a byte because the stepped value is read
  // back below for the end-of-cycle test), and store it back so the next call sees the advance.
  const frameIndex = mem8[TWOPLAYER_FRAME_CELL_814E];
  const nextFrameIndex = (frameIndex + FRAME_INDEX_STEP) & 0xff;
  mem8[TWOPLAYER_FRAME_CELL_814E] = nextFrameIndex;

  // ── Blit one tile pair into the descending column ────────────────────────────────────
  // TWOPLAYER_FRAME_CELL_8145 (0x8145) is the VRAM column offset — how far down the column we are this
  // cycle. Source is tableBase + frameIndex (this frame's two-byte tile pair in the ROM table the live-in
  // points at). Destination is FROG_ANIM_COLUMN_VRAM (0xa806) + that column offset — a column that is a
  // DIFFERENT VRAM region from the figure quad at 0xa846. Copy both bytes of the pair into the two
  // adjacent VRAM cells, then step the column offset down a full row so the next call paints below.
  const column = mem8[TWOPLAYER_FRAME_CELL_8145];
  const src = tableBase + frameIndex;
  const dest = FROG_ANIM_COLUMN_VRAM + column;
  mem8[dest] = mem8[src];
  mem8[dest + 1] = mem8[src + 1];
  mem8[TWOPLAYER_FRAME_CELL_8145] = column + COLUMN_STRIDE;

  // ── More frames left this cycle? ─────────────────────────────────────────────────────
  // While the stepped index is still short of 0x10 there are more tile pairs to paint below, so leave the
  // cursor advanced and return; the next emit paints the next row down.
  if (nextFrameIndex < FRAME_INDEX_LIMIT) return; // more frames to come this cycle

  // ── Cycle complete → tear it down and hand back ──────────────────────────────────────
  // The eighth frame just landed. Clear the busy latch SPRITE_FRAME_BUSY_LATCH1 (0x814f) — the interlock
  // release that re-enables the figure animator — and zero the whole dive-cycle state: the frame index
  // 0x814e, the column offset 0x8145, and the two surface-timer cells TWOPLAYER_FRAME_CELL_8146 (0x8146,
  // the countdown PERIOD / reload seed) and TWOPLAYER_FRAME_CELL_8147 (0x8147, the live countdown). With
  // every cell back at 0, the next arm re-seeds a fresh dive from scratch.
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 0;
  mem8[TWOPLAYER_FRAME_CELL_814E] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8145] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8146] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8147] = 0;
}
