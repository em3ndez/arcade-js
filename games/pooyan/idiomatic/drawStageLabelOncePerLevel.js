// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fillByteRun } from "./fillByteRun.js";
import { blitGlyphBlock4x3 } from "./blitGlyphBlock4x3.js";
import {
  LEVEL_TAG_DONE_LATCH,
  STAGE_COUNTDOWN,
  STAGE_TAG_COLUMN_TABLE,
  ROUND_COUNTER,
  ROUND_DIGIT_GLYPHS,
  ROUND_DIGIT_GLYPHS_ALT,
  STAGE_LABEL_PTR_TABLE,
  HUD_ROUND_TILE,
  HUD_STAGE_DIGIT_LO,
  HUD_STAGE_LABEL_TILE,
} from "./names.js";
/**
 * drawStageLabelOncePerLevel — stage-label HUD updater, run once per level.
 *
 * WHAT IT IS
 *   The top-of-screen game readout carries two things next to the score: the current round
 *   number and a fixed word label naming the stage. This routine is the ONCE-PER-LEVEL variant
 *   of that paint — it stamps the round number and stage label a single time when a level
 *   begins, then latches itself off so it does not repaint on every following frame (a separate
 *   per-frame refresher keeps the live countdown digit moving).
 *
 * ROLE IN THE MACHINE
 *   It sits in the round/stage/countdown readout chain at the top of the play field. The stage
 *   countdown STAGE_COUNTDOWN (0x8901) is the driver: its value both decides whether this stage
 *   even carries a label and, when it does, which label. On the very first stage of a level it
 *   also draws the round number; on later labelled stages it draws only the stage label.
 *
 * ROM 0x1f2f-0x1f86.
 *
 * GROUNDING: [seen] (per its names.js cert). The cells it touches carry their own tags in
 *   names.js — HUD_ROUND_TILE / HUD_STAGE_LABEL_TILE / HUD_STAGE_DIGIT_LO are the on-screen
 *   tilemap targets it writes.
 *
 * A one-shot: returns once the done-latch is set. A stage index below ten passes straight through as
 * column zero and arms the latch; a higher index is matched against the five-entry column table, and
 * a miss returns without drawing. On column zero it draws the BCD round number and mirrors the
 * countdown; every drawing path then draws the fixed stage label. LIVE-OUT: none.
 */
const TEN = 0x0a;
const TABLE_LEN = 5;
const BLANK_TILE = 0x10;
const BLANK_RUN = 0x03;
const TENS_BIT = 0x10; // bit 4 of a BCD byte = low bit of its tens digit; set on an odd tens digit -> the alternate glyph bank

/**
 * roundBcd — the displayed round number as a packed two-digit BCD byte.
 *
 * The screen shows the round one-based, so it counts round+1. The machine produces this by
 * counting a register up from zero (round+1) times, running a decimal-adjust after each step so
 * the value stays in BCD form; a count of zero means a full 256 passes. Only two decimal digits
 * are visible, so the running value wraps at 100. The result is packed high-nibble = tens,
 * low-nibble = units — exactly the byte the decimal-adjust leaves behind.
 */
function roundBcd(round) {
  // round+1 taken to 8 bits is the pass count; a wrapped 0 means the full 256-pass loop.
  const iters = ((round + 1) & 0xff) || 256;
  // Two visible digits only: the BCD readout rolls over at 100.
  const n = iters % 100;
  // Pack tens into the high nibble and units into the low nibble -> the BCD byte.
  return ((Math.trunc(n / 10) << 4) | (n % 10)) & 0xff;
}

export function drawStageLabelOncePerLevel(m) {
  const { mem8 } = m;

  // Gate on the once-per-level done-latch LEVEL_TAG_DONE_LATCH (0x8d56): a nonzero value means
  // this level's label has already been stamped, so nothing more to do this level.
  if (mem8[LEVEL_TAG_DONE_LATCH] !== 0) return; // one-shot: already drawn this level

  // The stage countdown STAGE_COUNTDOWN (0x8901) selects which stage this is. Map its value to a
  // "column code": a small index that picks the stage label (and, at column 0, arms the round
  // render). A value below ten is an ordinary stage; ten or above is a tagged/special stage that
  // must be looked up in the column table.
  const stage = mem8[STAGE_COUNTDOWN];
  let column;
  if (stage < TEN) {
    // Ordinary stage: it is column zero, and this is the point where the one-shot arms — the
    // latch is set here so an ordinary level draws its readout exactly once.
    mem8[LEVEL_TAG_DONE_LATCH] = 0x01; // arm the one-shot
    column = 0;
  } else {
    // Tagged stage: find this stage index among the five entries of the stage-tag column table
    // STAGE_TAG_COLUMN_TABLE (0x1f87). The matching slot number becomes the column code.
    let slot = 0;
    for (; slot < TABLE_LEN; slot++) if (mem8[STAGE_TAG_COLUMN_TABLE + slot] === stage) break;
    // No entry matched -> this stage index carries no label; leave the readout untouched.
    if (slot === TABLE_LEN) return; // not a labelled stage
    column = slot;
  }

  // Column zero is the first stage of a level, and only there is the round number (re)drawn.
  if (column === 0) { // first column -> draw the round number
    // Convert the round counter ROUND_COUNTER (0x8907) to the displayed BCD value, then let its
    // tens parity pick one of two glyph-block source rows in ROM (ROUND_DIGIT_GLYPHS 0x1fda vs
    // ROUND_DIGIT_GLYPHS_ALT 0x1fe6).
    const bcd = roundBcd(mem8[ROUND_COUNTER]);
    const bank = (bcd & TENS_BIT) !== 0 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS;
    // Stamp the round number as a 4-row x 3-column glyph block at HUD_ROUND_TILE (0x8722); the
    // blitter hands back the destination advanced just past the block for the trailing blank.
    const [after] = blitGlyphBlock4x3(m, bank, HUD_ROUND_TILE);
    // Clear the three tilemap cells right after the number with the blank tile (0x10) so any
    // wider previous value cannot leave stale glyphs beside the round digits.
    fillByteRun(m, after, BLANK_TILE, BLANK_RUN); // blank three trailing tiles
    // Mirror the current stage countdown into the units cell of the stage-countdown HUD number
    // HUD_STAGE_DIGIT_LO (0x8743) so the on-screen countdown starts from the right value.
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
  }

  // Every drawing path ends the same way: look up this column's stage-label glyph-block pointer
  // in the label pointer table STAGE_LABEL_PTR_TABLE (0x1fa3) (a little-endian word table indexed
  // by the column code)...
  const label = fetchWordFromTableIndex(m, column, STAGE_LABEL_PTR_TABLE);
  // ...and stamp that fixed label as a 4-row x 3-column glyph block into the stage-label slot of
  // the readout, HUD_STAGE_LABEL_TILE (0x8322).
  blitGlyphBlock4x3(m, label, HUD_STAGE_LABEL_TILE);
}
