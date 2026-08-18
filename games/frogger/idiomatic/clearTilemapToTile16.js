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
 *   Memory only. It writes 1024 VRAM tilemap cells and nothing else — no register the caller reads, no
 *   return value. The ROM version interleaves a per-row busy-wait delay (timing-only, to pace the writes
 *   on real video RAM); that delay affects nothing observable, so it is not reproduced here.
 */
import { VRAM_BASE } from "./names.js";

// The "blank" tile. Tile 0x10 (decimal 16) is Frogger's empty background cell — the same blank tile the
// other tilemap primitives (fillTilemapBlock28x32, the home-bay eraser) stamp to clear a region. Filling
// the map with it is what makes the screen read as empty.
const BLANK_TILE = 0x10;

// The tilemap is 32 cells wide by 32 cells tall = 1024 (0x400) cells, laid out contiguously in VRAM from
// VRAM_BASE (0xa800) through 0xabff. One flat loop over 0x400 therefore touches the whole screen.
const TILEMAP_CELLS = 0x400;

export function clearTilemapToTile16(m) {
  const { mem8 } = m;

  // ── Fill the whole tilemap with the blank tile ───────────────────────────────────────
  // Walk all 1024 cells as one contiguous run from VRAM_BASE (0xa800) and stamp the blank tile into each.
  // Because the tilemap is a single flat block of VRAM, no row/column arithmetic is needed — index i steps
  // straight through 0xa800..0xabff. (The ROM broke this into rows with a busy-wait between them for video
  // timing; the visible result is identical, so we just write the run.)
  for (let i = 0; i < TILEMAP_CELLS; i++) mem8[VRAM_BASE + i] = BLANK_TILE;
}
