// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearAndSeedScoreField  —  ROM 0x0629  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "wipe the board and lay a blank score field" routine, run once whenever the machine is about to
 *   paint a fresh board. It does three small bookkeeping writes and then one big one: it clears the active
 *   player's work RAM, zeroes the two-byte score-display cursor, marks the field as seeded, and finally
 *   tiles the whole score field with the blank-field marker tile so the board starts from a known,
 *   empty layout.
 *
 * WHERE IT SITS
 *   Called from the board-layout paths: setUpPlayStartOnce (ROM 0x230f) — the once-per-life start-of-play
 *   layout — and advanceBoardForeground (the board-completion handler), which reseeds the field between
 *   boards. It is never reached by plain attract, so it is exercised by the crafted-entry equivalence
 *   test at ROM 0x0629 rather than by attract frames. It leans on two helpers: clearActivePlayerWorkRam
 *   (ROM 0x07e6) for the leading wipe, and fillTenCellRun (ROM 0x0779) for each ten-cell tile stamp.
 *
 * LIVE-OUT
 *   Memory only. It writes the score-display cursor pair, the field-seeded flag, and the tiled field
 *   (plus whatever the leading clear touches). It returns nothing, and nothing downstream reads back a
 *   register from it — the HL/B churn fillTenCellRun publishes is internal to the fill loop.
 */
import { SCORE_DISPLAY_CURSOR_LO, SCORE_DISPLAY_CURSOR_HI, loc_83cc, FROG_ANIM_COLUMN_VRAM } from "./names.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { fillTenCellRun } from "./fillTenCellRun.js";

// The screen tilemap is 0x20 (32) cells wide, so ROWS = 0x20 also happens to be the number of field rows
// this routine paints — one fill pass per row. The loop below counts this down as an 8-bit register.
const ROWS = 0x20;

// Each visible row of the score field is two ten-cell tile runs split by a two-cell gap, then a ten-cell
// tail that is left untouched. Those four spans (10 + 2 + 10 + 10) sum to 0x20 — exactly one 32-cell row
// stride — which is how each pass steps the destination pointer straight down to the next row's start.
const RUN = 10;      // 0x0a — cells stamped per fillTenCellRun call (matches the helper's own run length)
const GAP = 2;       // the two-cell gap that splits a row's left run from its right run
const ROW_STEP = 0x0a; // the trailing (untouched) cells that carry the pointer from row end to the next row

export function clearAndSeedScoreField(m) {
  const { mem8 } = m;

  // ── Wipe the active player's work RAM ─────────────────────────────────────────────────
  // Hand off to clearActivePlayerWorkRam (ROM 0x07e6): in a one-player game (PLAY_FLAG 0x83fe == 1) it
  // returns untouched and the frog/home-bay state carries across; in a two-player game or attract it
  // zeroes the frog-object block and the home-bay gate bytes so the reseeding board starts on a blank
  // slate. Nothing here depends on which branch it takes; the equivalence oracle exercises both.
  clearActivePlayerWorkRam(m);

  // ── Zero the score-display cursor pair ────────────────────────────────────────────────
  // SCORE_DISPLAY_CURSOR_LO (0x839a) and SCORE_DISPLAY_CURSOR_HI (0x839b) are the low/high bytes of the
  // score-display write cursor. Clearing both rewinds the cursor to the top of the field so subsequent
  // score draws start from a known position on the freshly seeded board.
  mem8[SCORE_DISPLAY_CURSOR_LO] = 0;
  mem8[SCORE_DISPLAY_CURSOR_HI] = 0;

  // ── Mark the field as seeded ──────────────────────────────────────────────────────────
  // loc_83cc (0x83cc) is the field-seeded flag. Setting it to 1 records that this board's score field has
  // been laid out; awardExtraLife (ROM 0x0a5f) is the routine that later clears it back to 0 when it hands
  // out an extra life. This is the write the equivalence test's "skip-flag" tooth checks for.
  mem8[loc_83cc] = 1;

  // ── Tile the score field with the blank marker ────────────────────────────────────────
  // Walk down the field from FROG_ANIM_COLUMN_VRAM (0xa806), the field's top-left VRAM cell, painting one
  // row per iteration. fillTenCellRun stamps the blank-field marker (tile 0x10) into ten consecutive cells;
  // each row gets two such runs with a two-cell gap between them, and the row's trailing cells are left as
  // they were. Because 10 + 2 + 10 + 10 == 0x20 (one full row stride), the four advances below carry the
  // pointer from one row's start to the next.
  let dst = FROG_ANIM_COLUMN_VRAM;
  for (let row = ROWS; row !== 0; row = (row - 1) & 0xff) {
    // Left run: ten blank cells at the row's start, then step past them.
    fillTenCellRun(m, dst);
    dst = dst + RUN;

    // The two-cell gap. In the ROM this advance is an 8-bit operation on the pointer's low byte (register
    // L), so it cannot carry into the high byte / VRAM page. We reproduce that exactly — keep the high
    // byte, replace the low byte with (low + GAP) & 0xff — so the fill stays byte-identical to the oracle
    // even in the (never hit for this field's addresses) case where the low byte would wrap. The other
    // three advances are ordinary 16-bit HL adds, which is why only this one is masked.
    dst = (dst & ~0xff) | ((dst + GAP) & 0xff);

    // Right run: ten more blank cells past the gap, then step past them.
    fillTenCellRun(m, dst);
    dst = dst + RUN;

    // Skip the row's untouched tail to land on the next row's top-left cell (completes the 0x20 stride).
    dst = dst + ROW_STEP;
  }
}
