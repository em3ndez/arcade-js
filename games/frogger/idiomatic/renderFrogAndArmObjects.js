// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAndArmObjects  —  ROM 0x1952  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The board-init composite render for the frog scene. Once, at the very start of a life/board, it
 *   paints all the fixed "furniture" of the goal bay — three sets of frog tile columns, a side banner
 *   column, the four corners of the box that frames the goal, and the home-marker column — then raises
 *   the three object-ready flags and hands off to the object-animation seeder. Every value it writes is
 *   a constant tile number; nothing here reads the frog's live position, so this is a one-shot static
 *   layout, not a per-frame redraw.
 *
 * WHERE IT SITS
 *   Board setup only, never an ordinary gameplay frame. It is reached from the once-per-life layout
 *   setUpPlayStartOnce, which is driven by the per-frame scene core renderFrogSceneAndTickTimer
 *   (ROM 0x0942) at board start. Its tail runs straight into seedObjectAnimationState (ROM 0x1a02), which
 *   stamps the lane objects' initial animation counters — so "paint the furniture" and "seed the moving
 *   objects" are two ends of one uninterrupted board-init step.
 *
 * LIVE-OUT
 *   Memory only. It writes VRAM tile cells and the three object-ready flags, then tail-chains the seeder.
 *   It returns nothing the caller uses — both callers reload A immediately after — and leaves no register
 *   the caller reads.
 */
import {
  FROG_RENDER_VRAM_COL_G1, FROG_RENDER_VRAM_COL_G2, FROG_RENDER_VRAM_COL_G3, FROG_RENDER_BANNER_VRAM, FROG_RENDER_BOX_VRAM_CORNER, FROG_RENDER_HOME_MARKER_VRAM,
  FROG_RENDER_TILES_G1, FROG_RENDER_TILES_G2, FROG_RENDER_TILES_G3, OBJECT_READY_0, OBJECT_READY_1, OBJECT_READY_2,
} from "./names.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { seedObjectAnimationState } from "./seedObjectAnimationState.js";

// The Frogger tilemap addresses one on-screen row every 32 bytes (0x20). Adding ROW_STRIDE to a VRAM
// pointer therefore steps straight down by one screen row — the unit every write here advances by.
const ROW_STRIDE = 32;

// Extra gap the column-copy adds AFTER finishing a column, to reach the next column's top. Each column
// has already stepped four rows down (4 * 0x20 = 0x80) tile-by-tile; this +0x40 (two more rows) skips the
// blank strip between columns so the next column lands where the ROM places it.
const COLUMN_GAP = 64;

// Banner step between the two tiles of a pair's second write and the next pair's first write: +0xA0
// (five screen rows). The banner loop writes a tile, steps ROW_STRIDE (0x20) down, writes again, then
// steps BANNER_PAIR_GAP to the next pair — 0x20 + 0xA0 = 0xC0 (six rows) between successive pair starts.
const BANNER_PAIR_GAP = 160;

// Distance from the box's top-left corner (FROG_RENDER_BOX_VRAM_CORNER, 0xa844) down to its bottom-left
// corner: 864 bytes = 27 screen rows (864 / 32). Adding it to the top corner lands on the bottom corner.
const CORNER_SPAN = 864;

// The single tile (0x47) stamped repeatedly to draw the banner column.
const BANNER_TILE = 71;

// The four fixed tiles that draw the goal box's corners: top pair (0x41/0x42) at the top-left corner and
// the cell beside it; bottom pair (0x45/0x46) CORNER_SPAN rows below. All four are constant ROM literals.
const BOX_CORNER_TOP_LEFT = 65;
const BOX_CORNER_TOP_RIGHT = 66;
const BOX_CORNER_BOTTOM_LEFT = 69;
const BOX_CORNER_BOTTOM_RIGHT = 70;

export function renderFrogAndArmObjects(m) {
  const { mem8 } = m;

  // ── Three frog tile-column copies ────────────────────────────────────────────────────
  // Each pass copies a fixed 4-tile group from ROM down successive VRAM columns (see copyTileColumns
  // below). The group counts and bases are exactly the ROM's:
  //   - FROG_RENDER_TILES_G1 (0x19f6) into FROG_RENDER_VRAM_COL_G1 (0xa843), 5 columns;
  //   - FROG_RENDER_TILES_G2 (0x19fa) into FROG_RENDER_VRAM_COL_G2 (0xa8a4), 4 columns;
  //   - FROG_RENDER_TILES_G3 (0x19fe) into FROG_RENDER_VRAM_COL_G3 (0xa8a5), 4 columns.
  copyTileColumns(m, FROG_RENDER_VRAM_COL_G1, FROG_RENDER_TILES_G1, 5);
  copyTileColumns(m, FROG_RENDER_VRAM_COL_G2, FROG_RENDER_TILES_G2, 4);
  copyTileColumns(m, FROG_RENDER_VRAM_COL_G3, FROG_RENDER_TILES_G3, 4);

  // ── Banner column ────────────────────────────────────────────────────────────────────
  // Stamp BANNER_TILE (0x47) eight times — four vertical pairs — starting at FROG_RENDER_BANNER_VRAM
  // (0xa8c3). Within a pair the two writes are one screen row apart (+ROW_STRIDE); between pairs the
  // pointer jumps +BANNER_PAIR_GAP (five rows). The ROM lays the banner down as these paired dabs, not a
  // solid run, which is why the loop steps by two different amounts.
  let dst = FROG_RENDER_BANNER_VRAM;
  for (let i = 0; i < 4; i++) {
    mem8[dst] = BANNER_TILE; dst = dst + ROW_STRIDE;
    mem8[dst] = BANNER_TILE; dst = dst + BANNER_PAIR_GAP;
  }

  // ── Goal-box corners ─────────────────────────────────────────────────────────────────
  // Draw the four corner tiles of the box that frames the goal bay. The top pair sits at
  // FROG_RENDER_BOX_VRAM_CORNER (0xa844) and the cell to its right; the bottom pair sits CORNER_SPAN
  // (27 screen rows) below, at 0xa844 + 864 and the cell to its right. These are the box's outline, drawn
  // once and never moved.
  mem8[FROG_RENDER_BOX_VRAM_CORNER] = BOX_CORNER_TOP_LEFT;
  mem8[FROG_RENDER_BOX_VRAM_CORNER + 1] = BOX_CORNER_TOP_RIGHT;
  const bottom = FROG_RENDER_BOX_VRAM_CORNER + CORNER_SPAN;
  mem8[bottom] = BOX_CORNER_BOTTOM_LEFT;
  mem8[bottom + 1] = BOX_CORNER_BOTTOM_RIGHT;

  // ── Home-marker column ───────────────────────────────────────────────────────────────
  // Blit the fixed home-marker strip via the shared column stamp blitFourTileGroupColumn (ROM 0x19e2),
  // pointed at FROG_RENDER_HOME_MARKER_VRAM (0xa85c). That helper paints a repeating 2x2 tile group down
  // the column; here it draws the marker that shows where the frog must land in the goal bay.
  blitFourTileGroupColumn(m, FROG_RENDER_HOME_MARKER_VRAM);

  // ── Raise the object-ready flags ─────────────────────────────────────────────────────
  // Set the three object-ready flags OBJECT_READY_0/1/2 (0x8007 / 0x8009 / 0x800b) to 1. These tell the
  // per-frame sprite/object machinery that this board's objects are laid out and ready to be blitted and
  // animated. OBJECT_READY_0 (0x8007) doubles as the lead byte of the sprite-shadow DMA region, so this
  // also arms the shadow blit for the coming frames.
  mem8[OBJECT_READY_0] = 1;
  mem8[OBJECT_READY_1] = 1;
  mem8[OBJECT_READY_2] = 1;

  // ── Tail-chain: seed the object animation state ──────────────────────────────────────
  // The ROM ends with `jp loc_1a02` — a tail jump into seedObjectAnimationState (ROM 0x1a02), which
  // stamps the lane objects' initial animation counters so they start at staggered phases. Returning its
  // result reproduces that tail jump exactly: control never comes back here.
  return seedObjectAnimationState(m);
}

// Copy `columns` copies of a fixed 4-tile group down successive VRAM columns.
//
// `dst` walks the destination and `src` the ROM source group. Within one column the four tiles are laid
// straight down, one screen row (ROW_STRIDE = 0x20) apart; `src` restarts at the group base for every
// column, so each column receives the SAME four tiles. Between columns the pointer skips COLUMN_GAP (0x40)
// past the four rows just written to reach the next column's top. This is the ROM's stride-0x20,
// gap-0x40 column walk (0x1957 / 0x1974 / 0x1991).
function copyTileColumns(m, base, src, columns) {
  const { mem8 } = m;
  let dst = base;
  for (let c = 0; c < columns; c++) {
    let srcPtr = src;
    for (let row = 0; row < 4; row++) {
      mem8[dst] = mem8[srcPtr];
      srcPtr = srcPtr + 1;
      dst = dst + ROW_STRIDE;
    }
    dst = dst + COLUMN_GAP;
  }
}
