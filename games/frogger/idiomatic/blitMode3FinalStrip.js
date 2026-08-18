// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitMode3FinalStrip  —  ROM 0x0c17  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The shared "final strip" tail of the mode-3 attract screen — the SCORE RANKING page that cycles in
 *   demo mode (FROGGER logo, "SCORE RANKING" header, the five ranked high scores, "KONAMI 1981"). After
 *   the rest of that page has been painted, this routine draws ONE more decorative tile strip and clears
 *   the small state cell the mode-3 screen uses for its own bookkeeping. It is the very last brushstroke
 *   on the score-ranking picture.
 *
 * WHERE IT SITS
 *   Two callers reach it, and both leave mode 3 (GAME_MODE 0x83d6 == 3) already established:
 *     • renderMode3ScoreRankingScreen (0x0bb3) builds the whole ranking page and then FALLS THROUGH into
 *       this tail as its closing act — hence "final strip".
 *     • dispatchGameModeFrame (0x0d11), the per-frame attract state machine, JUMPS here directly once the
 *       mode-3 screen is already set up (and its mode-5 reset arm also tails in here), so the strip is
 *       re-blitted each frame the screen holds without rebuilding the entire page.
 *   It has a single callee, the shared column-blit primitive copyRunUpTileColumn (0x0028).
 *
 * LIVE-OUT
 *   Memory only. It writes one work cell (OBJECT_ANIM_STATE_8039) and 15 VRAM tile cells (the blitted column).
 *   It returns nothing: copyRunUpTileColumn hands back its walked pointers, but this tail ignores that
 *   result — the equivalence-0c17 test compares RAM alone and masks the dead stack scratch.
 */
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { OBJECT_ANIM_STATE_8039, MODE3_FINAL_STRIP_VRAM, MODE3_FINAL_STRIP_SRC } from "./names.js";

// The final strip is 15 tiles tall (0x0f). This is the byte the ROM loads into B as the DJNZ loop count
// for the blit below — kept in hex to mirror the ROM immediate. copyRunUpTileColumn treats a count of 0
// as 256, so 0x0f copies exactly 15, never wraps.
const FINAL_STRIP_LEN = 0x0f;

export function blitMode3FinalStrip(m) {
  const { mem8 } = m;

  // ── Step 1: clear the mode-3 strip-state cell ────────────────────────────────────────
  // OBJECT_ANIM_STATE_8039 (0x8039) is the little work byte the mode-3 screen keeps for its own sequencing.
  // Zeroing it here resets that state as part of finishing the page, so the next time the screen logic
  // runs it starts from a known-clear cell. This write must happen even though it is invisible on screen —
  // the equivalence test's "wrong-state" twin (which blits correctly but leaves the cell nonzero) is
  // caught precisely because the oracle zeros it.
  mem8[OBJECT_ANIM_STATE_8039] = 0;

  // ── Step 2: blit the 15-tile final strip up a VRAM column ─────────────────────────────
  // Draw the decorative strip via the shared primitive copyRunUpTileColumn (0x0028). It copies
  // FINAL_STRIP_LEN (15) bytes from the flat ROM tile run at MODE3_FINAL_STRIP_SRC (0x2f4d) into the
  // tilemap, starting at the column base MODE3_FINAL_STRIP_VRAM (0xaafc) and stepping the destination
  // BACK one 32-cell tilemap row per tile — the Galaxian-derived video hardware stores the 32-wide grid
  // so that one on-screen row is 32 addresses apart, so walking −32 climbs the screen and paints the
  // strip UP the column while the source walks forward through ROM. The primitive returns its advanced
  // pointers, but this tail is the end of the chain and discards them.
  copyRunUpTileColumn(m, MODE3_FINAL_STRIP_VRAM, MODE3_FINAL_STRIP_SRC, FINAL_STRIP_LEN);
}
