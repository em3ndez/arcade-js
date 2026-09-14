// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, PROJ_PT_Y, PROJ_PT_X, OBJECT_ANIM_PHASE, OBJECT_ANIM_TIMER, SEG_MID_X, SEG_MID_Y, ANIM_PHASE_DURATION, ANIM_PHASE_CODE, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI } from "./names.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { dispatchDrawSetup } from "./dispatchDrawSetup.js";
import { emitVectorWord } from "./emitVectorHeaderWord.js";

/**
 * animateShapeOneVector -- advance and emit one vector of the shape-1 enemy animation. ROM 0xb7eb.
 *
 * Role in the machine: one enemy shape (shape id 1 -- the special animated form drawn out of
 * drawEnemyShapeList's per-slot loop) is not a static template but a small keyframed animation.
 * This routine draws that enemy for the current frame: it positions the point at the enemy's
 * lane midpoint, projects it through the vector math-box, tears off the display-list header,
 * ages the animation's own sub-timer/phase, optionally runs the current keyframe's setup
 * handler, and emits the phase's vector-pair word so the shape morphs frame to frame. It is the
 * per-frame tick of that one shape's on-screen animation.
 *
 * Behavior: read the lane index loc_29, load PROJ_PT_Y/PROJ_PT_X from the lane-midpoint tables
 * SEG_MID_X/SEG_MID_Y at that index, then project the point (projectPointThroughMathbox) and lay
 * the record header (layHeaderAndBuildRecord with tag 0x61). Tick the sub-timer: OBJECT_ANIM_TIMER
 * -= 1 (8-bit wrap); on reaching 0 advance the phase OBJECT_ANIM_PHASE by one and reload the timer
 * from the per-phase duration table ANIM_PHASE_DURATION[phase]. Read the phase's code
 * ANIM_PHASE_CODE[phase]; when it is < 0x80 it is a handler index, so run dispatchDrawSetup with
 * it. Finally form the template index ((OBJECT_ANIM_PHASE << 1) + 0x28) & 0xff and emit the
 * vector-pair word from OBJ_TEMPLATE_WORD_LO/HI at that index (emitVectorWord).
 *
 * Live-out: PROJ_PT_X/PROJ_PT_Y (the projected point), OBJECT_ANIM_PHASE and OBJECT_ANIM_TIMER
 * (advanced/reloaded), the display list appended with the header and one emitted vector word, plus
 * whatever the phase handler (dispatchDrawSetup) sets up.
 *
 * Grounding: [seen].
 */
export function animateShapeOneVector(m) {
  const { mem8, mem16 } = m;
  const y = mem8[loc_29]; // enemy's lane index
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + y)]; // lane-midpoint coords into the projection point
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + y)];
  projectPointThroughMathbox(m);
  layHeaderAndBuildRecord(m, 0x61);
  let x = mem8[OBJECT_ANIM_PHASE];
  const ticked = (mem8[OBJECT_ANIM_TIMER] - 1) & 0xff; // sub-timer down one (8-bit wrap)
  mem8[OBJECT_ANIM_TIMER] = ticked;
  if (ticked === 0) {
    // Sub-timer wrapped: advance the keyframe phase and reload its duration.
    x = (x + 1) & 0xff;
    mem8[OBJECT_ANIM_PHASE] = x;
    mem8[OBJECT_ANIM_TIMER] = mem8[u16(ANIM_PHASE_DURATION + x)];
  }
  const phase = mem8[u16(ANIM_PHASE_CODE + x)];
  if (phase < 0x80) dispatchDrawSetup(m, phase); // < 0x80: a keyframe setup handler index
  // Template index for this phase's vector-pair word.
  const idx = ((mem8[OBJECT_ANIM_PHASE] << 1) + 0x28) & 0xff;
  emitVectorWord(m, mem8[u16(OBJ_TEMPLATE_WORD_LO + idx)], mem8[u16(OBJ_TEMPLATE_WORD_HI + idx)]);
}
