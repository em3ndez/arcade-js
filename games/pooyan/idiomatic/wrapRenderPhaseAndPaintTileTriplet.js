// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  STATUS_RENDER_PHASE,
  STATUS_RENDER_TILE_TABLE,
  STATUS_RENDER_VRAM_BASE,
  STATUS_FIELD_TILE_A,
  STATUS_FIELD_TILE_B,
} from "./names.js";
/**
 * wrapRenderPhaseAndPaintTileTriplet — the shared render tail that repaints a small animated
 * status widget once per animation step.
 *
 * ROM 0x23ad. Grounding: [seen].
 *
 * WHAT IT IS: a three-block repaint driven by a single phase counter. A phase counter in work
 * RAM cycles through the values 0,1,2,3; each value selects one four-byte tile-block descriptor
 * from a ROM word table, and that descriptor is stamped as a stack of three identical 2x2
 * character squares in the on-screen status area. The whole widget therefore animates by
 * marching the phase counter and letting the picture follow it. This routine performs one such
 * repaint: it clamps the phase, fetches the descriptor, and paints the three squares.
 *
 * ROLE IN THE MACHINE: this is the drawing half of a slow-animation pump. It is not called every
 * frame on its own — it is reached only when the animation is due to advance. A ring counter
 * (STATUS_RENDER_PHASE's neighbour) is ticked every frame and only borrows into the mod-4 phase
 * once per full ring, and it is that borrow which drops control here. So each visit means "the
 * phase just changed, redraw the widget to match".
 *
 * THE PHASE POINTER: the first two squares read their phase through `phasePtr` (the live pointer
 * on entry), while the third square's alternation reads the fixed status-render phase cell
 * STATUS_RENDER_PHASE (0x88bc) directly. On the paths that reach here these are the same cell,
 * so all three squares track one phase.
 *
 * LIVE-OUT: none — a void tail. Every effect lands in memory: the phase cell is written back
 * clamped, and the status-area video cells receive the three painted 2x2 blocks.
 */
const PHASE_MASK = 0x03; //   phase counter wraps mod 4
const FIELD_STRIDE = 0x40; // two video rows between the three status cells

export function wrapRenderPhaseAndPaintTileTriplet(m, phasePtr = m.regs.hl) {
  const { mem8 } = m;

  // STEP 1 — clamp the phase counter to 0..3 and write it back.
  // The counter at `phasePtr` is masked to its low two bits so it can only ever name one of the
  // four descriptor slots; the clamped value is stored back so the counter itself stays wrapped
  // mod 4 for the next visit. This is what makes the animation loop rather than run off the
  // end of the descriptor table.
  const phase = mem8[phasePtr] & PHASE_MASK;
  mem8[phasePtr] = phase;

  // STEP 2 — look up the tile-block descriptor for this phase.
  // STATUS_RENDER_TILE_TABLE (ROM 0x26f6) is a table of little-endian words, one per phase.
  // Indexing it by the clamped phase yields `src`, the address of the four source bytes that
  // define this phase's 2x2 picture. The four bytes are consumed by the block stamp below.
  const src = fetchWordFromTableIndex(m, phase, STATUS_RENDER_TILE_TABLE); // descriptor word for this phase

  // STEP 3 — stamp the top two squares of the widget from that one descriptor.
  // STATUS_RENDER_VRAM_BASE (0x8425) is the top-left cell of the widget in video RAM. The first
  // square lands there; the second lands FIELD_STRIDE (0x40 = two screen rows, since the video
  // row pitch is 0x20 bytes) further down the same column. Both share `src`, so the two squares
  // show the same frame.
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE, src);
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE + FIELD_STRIDE, src);

  // STEP 4 — choose the third square's source by the phase's low bit.
  // The bottom square does not use the descriptor table; it flips between two fixed 4-byte
  // source blocks on bit 0 of the status-render phase cell (0x88bc): odd phases take
  // STATUS_FIELD_TILE_A (0x270a), even phases take STATUS_FIELD_TILE_B (0x270e). This gives the
  // foot of the widget a two-state blink in step with the phase.
  const src3 = (mem8[STATUS_RENDER_PHASE] & 1) ? STATUS_FIELD_TILE_A : STATUS_FIELD_TILE_B;

  // STEP 5 — stamp the third square two rows below the second.
  // It sits at base + 2*FIELD_STRIDE (0x8425 + 0x80 = 0x84a5), completing the vertical stack of
  // three 2x2 blocks that make up the widget.
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE + 2 * FIELD_STRIDE, src3);
}
