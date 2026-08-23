// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  STATUS_RENDER_PHASE,
  STATUS_RENDER_TILE_TABLE,
  STATUS_RENDER_VRAM_BASE,
  STATUS_FIELD_TILE_A,
  STATUS_FIELD_TILE_B,
} from "./names.js";
/**
 * wrapRenderPhaseAndPaintTileTriplet — shared render tail. Masks the phase counter at `phasePtr` to 0..3, looks up a
 * tile-block descriptor for that phase, and stamps three 2x2 blocks two rows apart into video
 * RAM. The third block alternates between two sources on the phase's low bit.
 *
 * LIVE-OUT: none — a void tail; every effect lands in the phase cell and the video cells.
 */
const PHASE_MASK = 0x03; //   phase counter wraps mod 4
const FIELD_STRIDE = 0x40; // two video rows between the three status cells

export function wrapRenderPhaseAndPaintTileTriplet(m, phasePtr = m.regs.hl) {
  const { mem8 } = m;

  const phase = mem8[phasePtr] & PHASE_MASK;
  mem8[phasePtr] = phase;

  const src = loc_0c45(m, phase, STATUS_RENDER_TILE_TABLE); // descriptor word for this phase
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE, src);
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE + FIELD_STRIDE, src);

  const src3 = (mem8[STATUS_RENDER_PHASE] & 1) ? STATUS_FIELD_TILE_A : STATUS_FIELD_TILE_B;
  blit2x2TileBlock(m, STATUS_RENDER_VRAM_BASE + 2 * FIELD_STRIDE, src3);
}
