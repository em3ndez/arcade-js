// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderCreditLine  —  ROM 0x0b67  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Redraws the "CREDIT" line on the coin/attract display — the word CREDIT followed by the running
 *   two-digit tally you watch climb as you drop coins in. The very first time it runs after a reset it
 *   ALSO wipes the whole credit column clean, so no leftover board graphics show through behind the fresh
 *   line; that clear is latched to run exactly once. Every call after that just repaints the label and the
 *   current count in place.
 *
 * WHERE IT SITS
 *   A display leaf on the header-drawing arm. It is redrawn from three places: the foreground main loop
 *   paints it each frame (unless a game is actively in play, GAME_MODE == 1), the coin scanner
 *   scanCoinInputAndCredit (0x2cf0) repaints it the instant a coin is credited, and the cold-start init
 *   path repaints it once during boot. It owns no logic of its own beyond the one-time column clear —
 *   everything drawn goes through two shared tilemap primitives: copyRunUpTileColumn (0x0028) for the
 *   label strip and writePackedBcdByte (0x0ba0) for the two-digit count.
 *
 * LIVE-OUT
 *   Memory — the credit-column tile cells (first call only), the label cells, the per-column attribute
 *   shadow, and the two count-digit cells — PLUS the HL and DE pointers the two primitives leave advanced
 *   past whatever they drew. Callers read those pointers back, so the routine returns writePackedBcdByte's
 *   result (the stepped HL). The equivalence-0b67 test compares memory + HL + DE.
 */
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";
import {
  CREDIT_BCD, OBJRAM_COL3F_ATTR_SHADOW, CREDIT_COLUMN_CLEAR_LATCH, CREDIT_LABEL_STRIP,
  CREDIT_COLUMN_TOP_VRAM, CREDIT_LABEL_DST, CREDIT_COUNT_DST,
} from "./names.js";

const CLEAR_TILE = 0x10;   // blank tile stamped down the credit column on the one-time clear
const COLUMN_CELLS = 0x20; // 32 cells — the full height of the credit column
const ROW_STEP = 32;       // one 32-cell tilemap row; +32 addresses steps one cell DOWN the column
const LABEL_LEN = 0x06;    // "CREDIT" is 6 tiles wide

export function renderCreditLine(m) {
  const { mem8 } = m;

  // ── One-time credit-column clear (cold start only) ───────────────────────────────────
  // CREDIT_COLUMN_CLEAR_LATCH (0x83b4) reads 0 exactly once — on the first credit-line draw after a
  // reset — and is latched to 1 forever after. On that single first pass we blank the entire credit
  // column so nothing left over from a previous screen bleeds through behind the fresh line, then set the
  // latch so this clear is never repeated.
  if (mem8[CREDIT_COLUMN_CLEAR_LATCH] === 0) {
    mem8[CREDIT_COLUMN_CLEAR_LATCH] = 1;

    // Fill COLUMN_CELLS (0x20 = 32) cells with the blank tile 0x10, starting at the column's top cell
    // CREDIT_COLUMN_TOP_VRAM (0xa81f) and stepping +ROW_STEP each time. The tile RAM is 32 cells wide, so
    // +32 addresses is one screen row down — this walks straight DOWN the column, one cell per row.
    let cell = CREDIT_COLUMN_TOP_VRAM;
    for (let n = COLUMN_CELLS; n !== 0; n--) {
      mem8[cell] = CLEAR_TILE;
      cell = cell + ROW_STEP;
    }
  }

  // ── Blit the "CREDIT" label ──────────────────────────────────────────────────────────
  // Copy the 6-tile ROM label strip CREDIT_LABEL_STRIP (0x2f68) into VRAM at CREDIT_LABEL_DST (0xa97f)
  // via the shared column primitive, which walks the destination UP the column (−32 per byte) as it lays
  // the strip down and returns HL/DE stepped past it — pointers that form part of this routine's live-out.
  copyRunUpTileColumn(m, CREDIT_LABEL_DST, CREDIT_LABEL_STRIP, LABEL_LEN);

  // ── Set the per-column attribute shadow ──────────────────────────────────────────────
  // OBJRAM_COL3F_ATTR_SHADOW (0x803f) is the work-RAM shadow of OBJRAM column 0x3f's attribute byte,
  // DMA-copied to 0xb03f every frame. Writing 1 sets that column's attribute for the credit line. It is
  // only ever written by the display routines, never read back as a flag.
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;

  // ── Print the credit count ───────────────────────────────────────────────────────────
  // CREDIT_BCD (0x83e1) is the on-screen credit total as a packed-BCD byte — two decimal digits, tens in
  // the high nibble, ones in the low. writePackedBcdByte stamps it as two numerals at CREDIT_COUNT_DST
  // (0xa89f) and returns HL advanced two cells past them; that stepped HL is this routine's return value
  // and final live-out pointer.
  return writePackedBcdByte(m, mem8[CREDIT_BCD], CREDIT_COUNT_DST);
}
