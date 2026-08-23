// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0010 } from "./loc_0010.js";
import { blitGlyphBlock4x3 } from "./blitGlyphBlock4x3.js";
import {
  INTEGRITY_FLAG_SCAN_BASE,
  STAGE_COUNTDOWN,
  ROUND_COUNTER,
  ROUND_DIGIT_GLYPHS,
  ROUND_DIGIT_GLYPHS_ALT,
  STAGE_LABEL_PTR_TABLE,
  HUD_ROUND_TILE,
  HUD_STAGE_DIGIT_LO,
  HUD_STAGE_LABEL_TILE,
} from "./names.js";
/**
 * refreshRoundStageHud — per-frame round/stage HUD refresh.
 *
 * Holds off while any of the seven integrity-flag slots is armed. Otherwise it derives the stage
 * countdown's tens digit; only on the first stage (tens zero) does it draw the BCD round number (one
 * of two glyph banks by a tens bit), blank three trailing tiles, and mirror the countdown into its
 * HUD digit. Both paths then draw the fixed stage label. LIVE-OUT: none.
 */
const FLAG_PAIRS = 7;
const TEN = 0x0a;
const BLANK_TILE = 0x10;
const BLANK_RUN = 0x03;
const TENS_BIT = 0x10; // bit set on odd tens-digit -> the alternate glyph bank

// Emulate the "add 1 then decimal-adjust" up-counter run (round + 1) times from zero: the packed-BCD
// digits wrap at one hundred, and a count that wraps to zero runs the full 256 steps.
function roundBcd(round) {
  const iters = ((round + 1) & 0xff) || 256;
  const n = iters % 100;
  return ((Math.trunc(n / 10) << 4) | (n % 10)) & 0xff;
}

export function refreshRoundStageHud(m) {
  const { mem8 } = m;

  for (let i = 0; i < FLAG_PAIRS; i++) { // any armed integrity slot -> skip the refresh
    if ((mem8[INTEGRITY_FLAG_SCAN_BASE + i] | mem8[INTEGRITY_FLAG_SCAN_BASE + i + 1]) !== 0) return;
  }

  let countdown = mem8[STAGE_COUNTDOWN];
  let tens = 0;
  while (countdown >= TEN) { // tens = countdown / 10 by repeated subtraction
    countdown -= TEN;
    tens = (tens + 1) & 0xff;
  }

  let labelIndex = tens;
  if (tens === 0) { // first stage -> draw the round number
    const bcd = roundBcd(mem8[ROUND_COUNTER]);
    const bank = (bcd & TENS_BIT) !== 0 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS;
    const [after] = blitGlyphBlock4x3(m, bank, HUD_ROUND_TILE);
    loc_0010(m, after, BLANK_TILE, BLANK_RUN); // blank three trailing tiles
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
    labelIndex = 0;
  }

  const label = loc_0c45(m, labelIndex, STAGE_LABEL_PTR_TABLE);
  blitGlyphBlock4x3(m, label, HUD_STAGE_LABEL_TILE);
}
