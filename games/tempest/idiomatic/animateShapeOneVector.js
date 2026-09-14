// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, PROJ_PT_Y, PROJ_PT_X, OBJECT_ANIM_PHASE, OBJECT_ANIM_TIMER, SEG_MID_X, SEG_MID_Y, ANIM_PHASE_DURATION, ANIM_PHASE_CODE, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI } from "./names.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { dispatchDrawSetup } from "./dispatchDrawSetup.js";
import { emitVectorWord } from "./emitVectorHeaderWord.js";

// Refresh two axis parameters from the per-frame tables, run the two frame updaters, count down the
// sub-timer (on wrap advance the phase and reload the timer), optionally run the phase handler, then
// emit the phase's vector-pair word.
export function animateShapeOneVector(m) {
  const { mem8, mem16 } = m;
  const y = mem8[loc_29];
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + y)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + y)];
  projectPointThroughMathbox(m);
  layHeaderAndBuildRecord(m, 0x61);
  let x = mem8[OBJECT_ANIM_PHASE];
  const ticked = (mem8[OBJECT_ANIM_TIMER] - 1) & 0xff;
  mem8[OBJECT_ANIM_TIMER] = ticked;
  if (ticked === 0) {
    x = (x + 1) & 0xff;
    mem8[OBJECT_ANIM_PHASE] = x;
    mem8[OBJECT_ANIM_TIMER] = mem8[u16(ANIM_PHASE_DURATION + x)];
  }
  const phase = mem8[u16(ANIM_PHASE_CODE + x)];
  if (phase < 0x80) dispatchDrawSetup(m, phase);
  const idx = ((mem8[OBJECT_ANIM_PHASE] << 1) + 0x28) & 0xff;
  emitVectorWord(m, mem8[u16(OBJ_TEMPLATE_WORD_LO + idx)], mem8[u16(OBJ_TEMPLATE_WORD_HI + idx)]);
}
