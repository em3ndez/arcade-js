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
 * Scan a table for a value, then draw the stage header.
 *
 * Scans `count` bytes from `ptr` for `target`, tracking the slot in `slot`. No match returns
 * quietly. On a match at slot 0 the round number is rendered: count the round+1 in BCD, pick one
 * of two glyph blocks by the tens bit, blit it, clear the trailing cells, and mirror the stage
 * countdown into its HUD digit. Any match then draws the fixed stage label.
 *
 * LIVE-OUT: memory only — the tilemap header cells and the mirrored HUD digit.
 */

/** Count 0..times adding one in BCD each step (a binary->BCD loop). */
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

  // scan for target; slot tracks the index. the pre-decrement matches the shared loop latch.
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

  if (c === 0) {
    // render the round number
    let times = (mem8[ROUND_COUNTER] + 1) & 0xff;
    if (times === 0) times = 256;
    const bcd = bcdCount(times);
    const glyphTable = bcd & 0x10 ? ROUND_DIGIT_GLYPHS_ALT : ROUND_DIGIT_GLYPHS; // tens bit picks the block
    const [dstEnd] = blitGlyphBlock4x3(m, glyphTable, HUD_ROUND_TILE);
    fillByteRun(m, dstEnd, 0x10, 0x03); // clear the trailing cells
    mem8[HUD_STAGE_DIGIT_LO] = mem8[STAGE_COUNTDOWN];
  }

  // draw the fixed stage label; the label index is c on both paths — the matched slot on the
  // nonzero-slot path, and 0 on the slot-0 path where c is also 0.
  const labelPtr = fetchWordFromTableIndex(m, c, STAGE_LABEL_PTR_TABLE);
  blitGlyphBlock4x3(m, labelPtr, HUD_STAGE_LABEL_TILE);
}
