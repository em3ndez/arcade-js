// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fillByteRun } from "./fillByteRun.js";
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
 * refreshRoundStageHud — per-frame round/stage HUD refresh.  [seen]  (ROM 0x1f18-0x1f86)
 *
 * WHAT IT IS
 *   One tick of the top-of-screen game readout that shows the current round number and the
 *   stage label. It runs every frame as part of the round-number update chain (right after
 *   paintRoundNumberHud), so the two glyph fields at the top of the playfield stay live.
 *
 * ROLE IN THE MACHINE
 *   The stage countdown STAGE_COUNTDOWN (0x8901) drains from 0x20 toward 0 across a stage; its
 *   tens digit names which "stage" the player is in. This routine reads that countdown, works
 *   out the tens digit, and repaints two on-screen glyph blocks accordingly:
 *     - only while the tens digit is zero (the first/last stretch of a stage, countdown < 10)
 *       does it redraw the BCD round number at HUD_ROUND_TILE and mirror the raw countdown into
 *       the stage-digit HUD cell;
 *     - on every frame it draws the stage-label glyph block, selected by the tens digit, at
 *       HUD_STAGE_LABEL_TILE.
 *   A ROM-integrity interlock sits in front of all of this: if any of the seven anti-tamper
 *   flag slots is armed, the whole refresh is skipped so a tampered machine cannot keep
 *   repainting a valid-looking HUD.
 *
 * GROUNDING TAG: [seen].
 *
 * LIVE-OUT: none. The routine is screen-only: it paints tile cells in the on-screen tilemap
 *   (video RAM) — the round glyphs at HUD_ROUND_TILE (0x8722), the stage label at
 *   HUD_STAGE_LABEL_TILE (0x8322), and the mirrored countdown tile at HUD_STAGE_DIGIT_LO
 *   (0x8743). It leaves no game-state value in work RAM for any other routine to consume.
 */

// --- Fixed constants (all values baked into the ROM at these code sites) ---
const FLAG_PAIRS = 7; // seven overlapping byte-pairs of the anti-tamper flag block are scanned
const TEN = 0x0a; // decimal ten: the divisor for splitting the countdown into a tens digit
const BLANK_TILE = 0x10; // tilemap code for a blank/space tile
const BLANK_RUN = 0x03; // three trailing tiles are blanked after the round-number glyph block
const TENS_BIT = 0x10; // bit set on odd tens-digit -> the alternate glyph bank

// roundBcd — the on-screen round number.
//
// The HUD shows round+1 (round 0 is displayed as "1"), rendered as packed binary-coded decimal:
// each of the two decimal digits lives in one nibble. The ROM produces this by counting up from
// zero (round + 1) times, decimal-adjusting after every increment so the byte stays valid packed
// BCD and rolls over from 0x99 to 0x00 at one hundred. We reproduce that exactly here:
//   - iters = (round + 1) mod 256; a count that wraps to zero means the hardware loop runs its
//     full 256 steps (a zero loop-count on the Z80 counts 256), so we substitute 256;
//   - the up-counter wraps its two BCD digits at one hundred, so the visible value is iters mod 100;
//   - we pack that back into one byte as (tens << 4) | units.
function roundBcd(round) {
  const iters = ((round + 1) & 0xff) || 256;
  const n = iters % 100;
  return ((Math.trunc(n / 10) << 4) | (n % 10)) & 0xff;
}

export function refreshRoundStageHud(m) {
  const { mem8 } = m;

  // ROM-integrity interlock (ROM 0x1f1b-0x1f23). The seven-slot flag block based at
  // INTEGRITY_FLAG_SCAN_BASE (0x89e7) is the anti-tamper lattice's tripwire: on an intact
  // machine every slot is zero. We OR each slot with its neighbour (a sliding byte-pair, the
  // ROM's word test) and bail on the first armed pair, leaving the HUD untouched so a tampered
  // machine cannot keep drawing a healthy-looking readout.
  for (let i = 0; i < FLAG_PAIRS; i++) { // any armed integrity slot -> skip the refresh
    if ((mem8[INTEGRITY_FLAG_SCAN_BASE + i] | mem8[INTEGRITY_FLAG_SCAN_BASE + i + 1]) !== 0) return;
  }

  // Derive the stage number = tens digit of the per-stage countdown STAGE_COUNTDOWN (0x8901),
  // which drains from 0x20 toward 0 over a stage (ROM 0x1f25-0x1f4d). The ROM has no divide, so
  // it computes tens by repeated subtraction of ten, counting the subtractions.
  let countdown = mem8[STAGE_COUNTDOWN];
  let tens = 0;
  while (countdown >= TEN) { // tens = countdown / 10 by repeated subtraction
    countdown -= TEN;
    tens = (tens + 1) & 0xff;
  }

  // The tens digit indexes the stage-label glyph drawn at the tail. On the first stage the
  // countdown is still below ten (tens == 0), and only then is the round-number field redrawn.
  let labelIndex = tens;
  if (tens === 0) { // first stage -> draw the round number
    // Round number: BCD of ROUND_COUNTER (0x8907) + 1 (ROM 0x1f52-0x1f79).
    const bcd = roundBcd(mem8[ROUND_COUNTER]);
    // Two ROM glyph banks hold the round-number tiles; bit 4 of the packed value (bit 0 of the
    // tens nibble = an odd tens digit) picks the alternate bank ROUND_DIGIT_GLYPHS_ALT (0x1fe6),
    // otherwise the primary bank ROUND_DIGIT_GLYPHS (0x1fda).
    const bank = (bcd & TENS_BIT) !== 0 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS;
    // Stamp the 4x3 round-number glyph block into the tilemap at HUD_ROUND_TILE (0x8722); the
    // blit hands back the tile cursor sitting just past the block it wrote.
    const [after] = blitGlyphBlock4x3(m, bank, HUD_ROUND_TILE);
    fillByteRun(m, after, BLANK_TILE, BLANK_RUN); // blank three trailing tiles
    // Mirror the raw countdown value into the stage-countdown HUD digit cell HUD_STAGE_DIGIT_LO
    // (0x8743) so the on-screen units digit tracks the timer.
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
    // The first-stage label is entry 0 of the pointer table.
    labelIndex = 0;
  }

  // Shared tail (ROM 0x1f7a-0x1f86): look up the stage-label glyph pointer for this stage from
  // the little-endian word table STAGE_LABEL_PTR_TABLE (0x1fa3), then stamp that 4x3 label block
  // into the tilemap at HUD_STAGE_LABEL_TILE (0x8322). Both paths (round drawn or not) run this.
  const label = fetchWordFromTableIndex(m, labelIndex, STAGE_LABEL_PTR_TABLE);
  blitGlyphBlock4x3(m, label, HUD_STAGE_LABEL_TILE);
}
