// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapToTile16  —  ROM 0x0038  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The whole-screen wipe: it blanks the entire 32x32 background tilemap by writing the blank tile 0x10
 *   into every one of its 1024 cells. This is the coarsest paint primitive in the game — it does not draw
 *   anything, it just erases the playfield back to empty before something else lays a new screen down.
 *
 * WHERE IT SITS
 *   0x0038 is the Z80 `RST 38h` restart vector, so on real hardware this routine is reached by the
 *   one-byte `rst 0x38` opcode rather than a normal `call`. Frogger repurposes that vector as its screen
 *   wipe and fires it from every point that hands the screen a fresh layout: cold start
 *   (coldStartClearPlayRamAndSetMode), a new game (startNewGame), the intro / game-over entry
 *   (runIntroTimerThenInitGame), and the two-player board / continue setups (setUpBoardOrContinueLife,
 *   setUpPlayerTwoContinue). Its sibling fillTilemapBlock28x32 does the narrower clear that spares the
 *   4-column status margin; this one wipes everything.
 *
 * LIVE-OUT
 *   The 1024 blanked VRAM cells — no register the caller reads, no return value. The ROM interleaves a
 *   per-row busy-wait between the row writes, so on hardware/MAME the clear ANIMATES top-down over ~48
 *   displayed frames rather than blanking in one frame. That timing IS observable (it paces every
 *   screen transition and the tape-replay timeline), so the delay is charged as displayed frames and the
 *   rows are revealed progressively — see WIPE_DELAY_FRAMES.
 */
import { VRAM_BASE } from "./names.js";

// The "blank" tile. Tile 0x10 (decimal 16) is Frogger's empty background cell — the same blank tile the
// other tilemap primitives (fillTilemapBlock28x32, the home-bay eraser) stamp to clear a region. Filling
// the map with it is what makes the screen read as empty.
const BLANK_TILE = 0x10;

// The tilemap is 32 rows of 32 cells = 1024 (0x400), contiguous in VRAM from VRAM_BASE (0xa800). Row r
// occupies cells [r*32, r*32+32); the ROM clears one row per busy-wait pass, top-down.
const TILEMAP_ROWS = 32;
const TILEMAP_COLS = 32;
const TILEMAP_CELLS = TILEMAP_ROWS * TILEMAP_COLS;

// Displayed frames the ROM's per-row busy-wait spans. Measured from MAME (frogger-golden): the boot wipe
// blanks row 0 at frame 49 and all 32 rows by frame 97 — 48 frames, ~0.667 rows/frame.
const WIPE_DELAY_FRAMES = 48;

export function clearTilemapToTile16(m) {
  const { mem8 } = m;

  // Snapshot the pre-wipe screen so the delay frames can reveal the blank top-down over what was there
  // (a real transition wipes visible content, not black). Own array — the fill below mutates VRAM, and
  // mem8 is index-access only (no .slice).
  const pre = new Uint8Array(TILEMAP_CELLS);
  for (let i = 0; i < TILEMAP_CELLS; i++) pre[i] = mem8[VRAM_BASE + i];

  // Fill the whole tilemap with the blank tile: this is the memory end-state; the animation below is
  // display-only and must not change it.
  for (let i = 0; i < TILEMAP_CELLS; i++) mem8[VRAM_BASE + i] = BLANK_TILE;

  // Charge the ROM's per-row busy-wait as displayed frames so the timeline matches MAME, and reveal the
  // blank progressively over that span (round(...) tracks MAME's ~0.667 rows/frame: 1 row by the first
  // frame, all 32 by the last). The delay is display-only, but VRAM is shared with the paused game: the
  // caller's same-frame redraw and any cell the vblank NMI draws mid-wait are real content, so `truth`
  // tracks them (seeded from VRAM on frame 0, then folded forward from every cell the NMI changed behind
  // the animation) and is handed back on the last frame — otherwise the blank writes gap-hole the board.
  m.busyDelayFrames = (m.busyDelayFrames | 0) + WIPE_DELAY_FRAMES;
  let truth = null; // the game's real VRAM (redraw + NMI writes), kept apart from the animation overlay
  let shown = null; // what the overlay last wrote, so a differing cell is an NMI write to fold into truth
  m.busyDelayRender = (mm, i, total) => {
    const vram = mm.mem8;
    if (i === 0) {
      truth = new Uint8Array(TILEMAP_CELLS);
      shown = new Uint8Array(TILEMAP_CELLS);
      for (let j = 0; j < TILEMAP_CELLS; j++) truth[j] = vram[VRAM_BASE + j];
    } else {
      for (let j = 0; j < TILEMAP_CELLS; j++) if (vram[VRAM_BASE + j] !== shown[j]) truth[j] = vram[VRAM_BASE + j];
    }
    const done = Math.round(((i + 1) * TILEMAP_ROWS) / total);
    const last = i === total - 1;
    for (let r = 0; r < TILEMAP_ROWS; r++) {
      for (let c = 0; c < TILEMAP_COLS; c++) {
        const idx = r * TILEMAP_COLS + c;
        const v = last ? truth[idx] : r < done ? BLANK_TILE : pre[idx];
        vram[VRAM_BASE + idx] = v;
        shown[idx] = v;
      }
    }
  };
}
