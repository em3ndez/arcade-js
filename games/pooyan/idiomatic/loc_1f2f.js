// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0010 } from "./loc_0010.js";
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
 * loc_1f2f — stage-label HUD updater, run once per level.
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
const TENS_BIT = 0x10; // bit set on odd tens-digit -> the alternate glyph bank

function roundBcd(round) {
  const iters = ((round + 1) & 0xff) || 256;
  const n = iters % 100;
  return ((Math.trunc(n / 10) << 4) | (n % 10)) & 0xff;
}

export function loc_1f2f(m) {
  const { mem8 } = m;

  if (mem8[LEVEL_TAG_DONE_LATCH] !== 0) return; // one-shot: already drawn this level

  const stage = mem8[STAGE_COUNTDOWN];
  let column;
  if (stage < TEN) {
    mem8[LEVEL_TAG_DONE_LATCH] = 0x01; // arm the one-shot
    column = 0;
  } else {
    let slot = 0;
    for (; slot < TABLE_LEN; slot++) if (mem8[STAGE_TAG_COLUMN_TABLE + slot] === stage) break;
    if (slot === TABLE_LEN) return; // not a labelled stage
    column = slot;
  }

  if (column === 0) { // first column -> draw the round number
    const bcd = roundBcd(mem8[ROUND_COUNTER]);
    const bank = (bcd & TENS_BIT) !== 0 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS;
    const [after] = blitGlyphBlock4x3(m, bank, HUD_ROUND_TILE);
    loc_0010(m, after, BLANK_TILE, BLANK_RUN); // blank three trailing tiles
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
  }

  const label = loc_0c45(m, column, STAGE_LABEL_PTR_TABLE);
  blitGlyphBlock4x3(m, label, HUD_STAGE_LABEL_TILE);
}
