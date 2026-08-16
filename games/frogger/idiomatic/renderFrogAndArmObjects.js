// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAndArmObjects — frog sprite render: copy three 4-tile groups down VRAM columns, stamp the banner column
 * and four box corners, blit the home-marker tile string, raise three object flags, and tail-chain
 * the object-anim init. LIVE-OUT: memory-only (both callers reload A right after).
 */
import {
  FROG_RENDER_VRAM_COL_G1, FROG_RENDER_VRAM_COL_G2, FROG_RENDER_VRAM_COL_G3, FROG_RENDER_BANNER_VRAM, FROG_RENDER_BOX_VRAM_CORNER, FROG_RENDER_HOME_MARKER_VRAM,
  FROG_RENDER_TILES_G1, FROG_RENDER_TILES_G2, FROG_RENDER_TILES_G3, OBJECT_READY_0, OBJECT_READY_1, OBJECT_READY_2,
} from "./names.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { seedObjectAnimationState } from "./seedObjectAnimationState.js";

const ROW_STRIDE = 32;
const COLUMN_GAP = 64;
const BANNER_PAIR_GAP = 160;
const CORNER_SPAN = 864;
const BANNER_TILE = 71;

export function renderFrogAndArmObjects(m) {
  const { mem8 } = m;

  copyTileColumns(m, FROG_RENDER_VRAM_COL_G1, FROG_RENDER_TILES_G1, 5);
  copyTileColumns(m, FROG_RENDER_VRAM_COL_G2, FROG_RENDER_TILES_G2, 4);
  copyTileColumns(m, FROG_RENDER_VRAM_COL_G3, FROG_RENDER_TILES_G3, 4);

  let hl = FROG_RENDER_BANNER_VRAM;
  for (let i = 0; i < 4; i++) {
    mem8[hl] = BANNER_TILE; hl = (hl + ROW_STRIDE) & 0xffff;
    mem8[hl] = BANNER_TILE; hl = (hl + BANNER_PAIR_GAP) & 0xffff;
  }

  mem8[FROG_RENDER_BOX_VRAM_CORNER] = 65; mem8[(FROG_RENDER_BOX_VRAM_CORNER + 1) & 0xffff] = 66;
  const bottom = (FROG_RENDER_BOX_VRAM_CORNER + CORNER_SPAN) & 0xffff;
  mem8[bottom] = 69; mem8[(bottom + 1) & 0xffff] = 70;

  blitFourTileGroupColumn(m, FROG_RENDER_HOME_MARKER_VRAM);

  mem8[OBJECT_READY_0] = 1; mem8[OBJECT_READY_1] = 1; mem8[OBJECT_READY_2] = 1;

  return seedObjectAnimationState(m);
}

// Copy `columns` groups of four source tiles down successive VRAM columns.
function copyTileColumns(m, base, src, columns) {
  const { mem8 } = m;
  let hl = base;
  for (let c = 0; c < columns; c++) {
    let de = src;
    for (let row = 0; row < 4; row++) {
      mem8[hl] = mem8[de];
      de = (de + 1) & 0xffff;
      hl = (hl + ROW_STRIDE) & 0xffff;
    }
    hl = (hl + COLUMN_GAP) & 0xffff;
  }
}
