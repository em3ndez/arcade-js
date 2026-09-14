// SPDX-License-Identifier: GPL-3.0-only
import { PROJ_PT_Y, OBJ_DEPTH, SLOT_LOOP_INDEX, loc_14d, loc_14e, SCORE_DISPLAY_TIMER } from "./names.js";
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";

/**
 * emitSegmentedSpanBetweenCursors — draw a tick-marked vector run spanning a near→far cursor pair. ROM 0xb15a.
 *
 * Role in the machine: builds a segmented line/scale spanning the interval bounded by the near cursor
 * loc_14d and the far cursor loc_14e. It walks a cursor across that span in fixed steps and lays down, per
 * step, a positioned header, a segment-numbered tick marker, and the shared coordinate pair — so on screen
 * the run reads as a subdivided span with a mark at each subdivision — then caps it with two fixed trailer
 * words. The single decrement of SCORE_DISPLAY_TIMER ties this draw to the score/high-score display's
 * countdown.
 *
 * Behavior: stashes the two inputs into OBJ_DEPTH ($57 = a) and PROJ_PT_Y ($56 = x) so they can be reused
 * as the coordinate pair each step. Seeds the loop index SLOT_LOOP_INDEX ($37) from the near cursor
 * loc_14d and ticks SCORE_DISPLAY_TIMER ($16e) down by one. Then loops: emit a header word
 * (emitVectorWordTag70) whose bytes are the cursor's high bits (cur>>5) and low bits ((cur<<2)&0x7f);
 * choose a marker — 0x00 at the very first position (cur == loc_14d), else the segment number (cur>>3)&7
 * with the top segment 7 folded to 3 — and emit it tagged 0x68 (emitTaggedVectorWord); emit the stashed
 * coordinate pair (emitCoordinateVectorWord of OBJ_DEPTH, PROJ_PT_Y); advance the cursor by 2. The loop
 * repeats while the index stays below the far cursor loc_14e. After the span, it draws two fixed trailers:
 * drawSlotShapeWithHeader(0xd0, 0x2c) and emitCoordinateVectorWord(0x3f, 0xf2).
 *
 * Live-out: OBJ_DEPTH ($57) and PROJ_PT_Y ($56) = the stashed inputs, SLOT_LOOP_INDEX ($37) left at the
 * loop's terminating value, SCORE_DISPLAY_TIMER ($16e) decremented, the emitted span + trailer words in the
 * display list, and the advanced draw cursor loc_74. Grounding: [seen].
 */
export function emitSegmentedSpanBetweenCursors(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  // Stash the two inputs as the reusable coordinate pair for every step.
  mem8[OBJ_DEPTH] = a;
  mem8[PROJ_PT_Y] = x;
  // Seed the walking cursor at the near bound and tick the display countdown.
  mem8[SLOT_LOOP_INDEX] = mem8[loc_14d];
  mem8[SCORE_DISPLAY_TIMER] = mem8[SCORE_DISPLAY_TIMER] - 1;
  do {
    const cur = mem8[SLOT_LOOP_INDEX];
    // Header word: cursor high bits as the Y byte, cursor low bits (<<2, masked) as the payload.
    emitVectorWordTag70(m, cur >> 5, (cur << 2) & 0x7f);
    let marker;
    if (cur === mem8[loc_14d]) {
      // First position gets a plain 0 marker.
      marker = 0x00;
    } else {
      // Otherwise the segment number (cur>>3)&7, with the top segment 7 folded down to 3.
      const seg = (cur >> 3) & 0x07;
      marker = seg === 0x07 ? 0x03 : seg;
    }
    // Emit the tick marker tagged 0x68.
    emitTaggedVectorWord(m, 0x68, marker);
    // Emit the stashed coordinate pair for this step.
    emitCoordinateVectorWord(m, mem8[OBJ_DEPTH], mem8[PROJ_PT_Y]);
    // Step the cursor two forward.
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] + 2;
  } while (mem8[SLOT_LOOP_INDEX] < mem8[loc_14e]);
  // Two fixed trailer words close the span.
  drawSlotShapeWithHeader(m, 0xd0, 0x2c);
  emitCoordinateVectorWord(m, 0x3f, 0xf2);
}
