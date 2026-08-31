// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blitGlyphBlock4x3 } from "./blitGlyphBlock4x3.js";
import { fillByteRun } from "./fillByteRun.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import {
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  HUD_STAGE_DIGIT_LO,
  HUD_ROUND_TILE,
  HUD_STAGE_LABEL_TILE,
  ROUND_DIGIT_GLYPHS,
  ROUND_DIGIT_GLYPHS_ALT,
  STAGE_LABEL_PTR_TABLE,
} from "./names.js";
/**
 * findTableSlotAndPaintStageHeader -- find a table slot, then paint the top-of-screen stage header.
 *
 * WHAT IT IS
 *   The shared tail of the game's stage-header refresh, reached through a table scan. The player
 *   never sees this as a distinct thing: it is the piece that keeps the top-of-screen readouts --
 *   the big ROUND number and the fixed stage label -- correct as the game moves from stage to
 *   stage. The caller hands it a value to look up in a small ROM table (the stage-band lookup);
 *   the slot that value lands in tells the routine which stage the player is on. Slot 0 means the
 *   very first stage of a level, and only then does the round number get repainted; every match,
 *   first stage or not, repaints the stage label chosen by the slot.
 *
 * ROLE IN THE MACHINE
 *   This is the bottom of the stage/round HUD chain that runs each frame while the game is live.
 *   The chain derives the stage-countdown's tens digit, uses it as the search value, and calls in
 *   here to (a) resolve which stage label to show and (b), on the first stage of the level, redraw
 *   the round number. It sits next to the block-stamp glyph primitives it leans on and the BCD
 *   number code the rest of the HUD shares.
 *
 * ROM ADDRESS: 0x1f40. GROUNDING: [seen].
 *
 * INPUTS
 *   target -- the byte to find in the table (the stage-band key the caller derived).
 *   ptr    -- start of the ROM table being scanned.
 *   count  -- number of table bytes to scan.
 *   slot   -- starting slot index (normally 0); increments as the scan walks the table.
 *
 * LIVE-OUT: memory only. It writes tilemap cells for the round-number glyph block (at
 *   HUD_ROUND_TILE) and the stage-label glyph block (at HUD_STAGE_LABEL_TILE), blanks three
 *   trailing round-number cells, and mirrors the stage countdown into its HUD digit
 *   (HUD_STAGE_DIGIT_LO). No value is returned; a no-match returns having touched nothing.
 */

/**
 * bcdCount -- count 0..times, incrementing in packed binary-coded decimal each step.
 *
 * The Z80 stores on-screen numbers as packed BCD (two decimal digits per byte, one per nibble),
 * and produces them by counting a value up one at a time with a decimal-adjust after each add.
 * This mirrors that: the low nibble rolls 0->9 then carries into the high nibble (0x09 -> 0x10,
 * ..., 0x90 -> 0x00), so after `times` steps the accumulator holds the packed-BCD form of the
 * count. Here it converts the round ordinal (round+1) into the two decimal digits the HUD draws.
 */
function bcdCount(times) {
  let a = 0x00;
  for (let i = 0; i < times; i++) {
    if ((a & 0x0f) !== 0x09) a += 1;
    else a = (a & 0xf0) === 0x90 ? 0x00 : (a & 0xf0) + 0x10;
  }
  return a;
}

export function findTableSlotAndPaintStageHeader(m, target = m.regs.a, ptr = m.regs.hl, count = m.regs.b, slot = m.regs.c) {
  const { mem8 } = m;

  // STEP 1 -- scan the ROM table for `target`, tracking which slot it lands in.
  // The scan walks up to `count` bytes from `ptr`, bumping the slot index `c` and the pointer `p`
  // one at a time until a byte equals `target`. The counter starts one below `count`: this entry
  // is prefixed by a decrement before joining the shared scan loop, whose own down-counter tests
  // for exhaustion after the step, so the effective trip count is `count`. If the loop drains
  // without a match it returns immediately, leaving the header untouched -- a value that belongs
  // to no stage band paints nothing.
  let n = (count - 1) & 0xff;
  let p = ptr;
  let c = slot & 0xff;
  for (;;) {
    if (target === mem8[p]) break; // matched
    c = (c + 1) & 0xff;
    p = u16(p + 1);
    n = (n - 1) & 0xff;
    if (n === 0) return; // no match
  }

  // STEP 2 -- first stage of the level only (matched at slot 0): repaint the big ROUND number.
  // Slot 0 is the first stage; on every later stage the round number is already on screen and this
  // whole block is skipped.
  if (c === 0) {
    // Turn the round counter into its on-screen ordinal. ROUND_COUNTER (0x8907) is 0-based, so the
    // displayed round is counter+1; a counter of 0xff maps to a full 256 counting passes (the
    // hardware counting loop is exit-tested, so a zero step count means the maximum, not zero).
    let times = (mem8[ROUND_COUNTER] + 1) & 0xff;
    if (times === 0) times = 256;
    // Convert that ordinal to packed BCD so it can be drawn as decimal digits.
    const bcd = bcdCount(times);
    // Pick the round-digit glyph bank by the tens bit (bit 4 of the packed-BCD byte, i.e. whether
    // the tens digit is odd): the two ROM glyph tables (ROUND_DIGIT_GLYPHS 0x1fda /
    // ROUND_DIGIT_GLYPHS_ALT 0x1fe6) carry the two digit-block variants.
    const glyphTable = bcd & 0x10 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS; // tens bit picks the block
    // Stamp the round number as a 4-row-by-3-column glyph block at HUD_ROUND_TILE (0x8722), the
    // base cell of the round readout; the stamp hands back the cell just past the block.
    const [dstEnd] = blitGlyphBlock4x3(m, glyphTable, HUD_ROUND_TILE);
    // Wipe the three cells trailing the block with the blank tile 0x10 so a shorter number does
    // not leave stale digits from a previous, longer round on screen.
    fillByteRun(m, dstEnd, 0x10, 0x03); // clear the trailing cells
    // Mirror the live stage countdown (STAGE_COUNTDOWN 0x8901) into its HUD digit cell
    // (HUD_STAGE_DIGIT_LO 0x8743) so the countdown readout tracks the counter.
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
  }

  // STEP 3 -- every match paints the fixed stage label chosen by the matched slot.
  // The slot `c` indexes STAGE_LABEL_PTR_TABLE (0x1fa3), a little-endian word table of glyph-block
  // pointers, one per stage; on the slot-0 path `c` is likewise 0, so the same index serves both
  // branches. Fetch the label's glyph pointer and stamp it as a 4x3 block at HUD_STAGE_LABEL_TILE
  // (0x8322), the base cell of the stage-label readout.
  const labelPtr = fetchWordFromTableIndex(m, c, STAGE_LABEL_PTR_TABLE);
  blitGlyphBlock4x3(m, labelPtr, HUD_STAGE_LABEL_TILE);
}
