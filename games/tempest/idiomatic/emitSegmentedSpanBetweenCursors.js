// SPDX-License-Identifier: GPL-3.0-only
import { PROJ_PT_Y, OBJ_DEPTH, SLOT_LOOP_INDEX, loc_14d, loc_14e, SCORE_DISPLAY_TIMER } from "./names.js";
import { loc_df6c } from "./loc_df6c.js";
import { loc_df4c } from "./loc_df4c.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";

// Stash the two inputs, then walk a cursor from the low bound to the high bound in
// steps of two, emitting three vector words per step (a header, a per-step marker
// whose value depends on the cursor's position, and the stashed pair). Then draw
// two fixed trailer words.
export function emitSegmentedSpanBetweenCursors(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[OBJ_DEPTH] = a;
  mem8[PROJ_PT_Y] = x;
  mem8[SLOT_LOOP_INDEX] = mem8[loc_14d];
  mem8[SCORE_DISPLAY_TIMER] = mem8[SCORE_DISPLAY_TIMER] - 1;
  do {
    const cur = mem8[SLOT_LOOP_INDEX];
    loc_df6c(m, cur >> 5, (cur << 2) & 0x7f);
    let marker;
    if (cur === mem8[loc_14d]) {
      marker = 0x00;
    } else {
      const seg = (cur >> 3) & 0x07;
      marker = seg === 0x07 ? 0x03 : seg;
    }
    loc_df4c(m, 0x68, marker);
    emitCoordinateVectorWord(m, mem8[OBJ_DEPTH], mem8[PROJ_PT_Y]);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] + 2;
  } while (mem8[SLOT_LOOP_INDEX] < mem8[loc_14e]);
  drawSlotShapeWithHeader(m, 0xd0, 0x2c);
  emitCoordinateVectorWord(m, 0x3f, 0xf2);
}
