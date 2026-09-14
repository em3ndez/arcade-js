// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_9e, ENEMY_ANIM_ACCUM, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, SEG_STYLE_TABLE } from "./names.js";
import { buildSlotScreenPoint } from "./buildSlotScreenPoint.js";
import { drawTubeRimSegmentFromCorner, emitTubeRimSegmentVectors } from "./drawTubeRimSegmentFromCorner.js";

/**
 * drawStyledSlotRimSegment — draw one animated tube-rim segment for slot x. ROM 0xb71b.
 *
 * Role in the machine: the tube rim between adjacent lanes pulses and flips as enemies
 * (flippers) traverse it. This routine renders the rim segment attached to one enemy slot,
 * choosing its brightness/style from an animation phase so the rim shimmers frame to frame.
 * It is the styled front-end to the shared segment emitters.
 *
 * Behaviour: derive a run flag into loc_9e from the sign of the animation accumulator
 * ENEMY_ANIM_ACCUM (0x148): 0x04 when negative, else 0x00. Pick a style byte: bias the
 * accumulator by 0x40, take the high nibble (>>4) as a table index, clamp it to 0 once it
 * reaches 5 (SEG_STYLE_TABLE holds five phases), and latch SEG_STYLE_TABLE[idx] into loc_29.
 * Then branch on the sign of this slot's flags byte ENEMY_SLOT_FLAGS+x: if negative the
 * enemy sits at a slot point, so build its screen point (buildSlotScreenPoint) and emit the
 * segment directly via emitTubeRimSegmentVectors(loc_29); otherwise the enemy is on a rim
 * corner, so fetch that corner from ENEMY_SEGMENT+x and draw from it via
 * drawTubeRimSegmentFromCorner(loc_29, corner).
 *
 * Live-out: loc_9e (run flag) and loc_29 (style byte) for the segment emitters, plus the
 * vector records those emitters append to the display list.
 *
 * Grounding: [seen].
 */
export function drawStyledSlotRimSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = (mem8[ENEMY_ANIM_ACCUM] & 0x80) ? 0x04 : 0x00; // run flag from anim phase sign
  let idx = ((mem8[ENEMY_ANIM_ACCUM] + 0x40) & 0xff) >> 4;      // biased high nibble -> phase index
  if (idx >= 0x05) idx = 0x00;                                  // only five style phases exist
  mem8[loc_29] = mem8[u16(SEG_STYLE_TABLE + idx)];              // latch the phase's style byte
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {                 // sign set: enemy at a slot point
    buildSlotScreenPoint(m, x);
    emitTubeRimSegmentVectors(m, mem8[loc_29]);
    return;
  }
  const corner = mem8[u16(ENEMY_SEGMENT + x)];                  // else enemy on a rim corner
  drawTubeRimSegmentFromCorner(m, mem8[loc_29], corner);
}
