// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, DEPTH_HI, PROJ_OFS_X_LO, PROJ_OFS_X_HI,
  PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, VG_RECORD_HEADER, DRAW_CURSOR_ALT_LO, DRAW_CURSOR_ALT_HI, loc_9e,
  PLAYER_SHOT_DEPTH, OBJECT_AXIS1_POS, ENEMY_SLOT_FLAGS, ENEMY_POS2,
} from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { emitVectorWordTag60FromKey } from "./emitVectorWordTag60FromKey.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { loc_df6a } from "./loc_df6a.js";
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";
import { emitRecordBodyC0 } from "./emitRecordBodyC0.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { swapDrawPointers } from "./swapDrawPointers.js";
import { returnConstantTwo } from "./returnConstantTwo.js";
import { selectPointerPair } from "./selectPointerPair.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";
import { emitObjectPositionVector } from "./emitObjectPositionVector.js";

// Reset the accumulators and seeds, cache the base pointer pair, then for each active
// slot from the top down: integrate its deltas, emit its record with header and shadow,
// and close the frame by swapping pointers back and drawing the base list.
export function drawMovingObjectSlots(m) {
  const { mem8 } = m;
  emitCoordinateVectorWord(m, 0x3f, 0xf2);
  mem8[PREV_Y_LO] = 0x00;
  mem8[PREV_Y_HI] = 0x00;
  mem8[PREV_X_LO] = 0x00;
  mem8[PREV_X_HI] = 0x00;
  mem8[PLAYER_SHOT_DEPTH] = 0x00;
  mem8[PROJ_OFS_X_LO] = 0x00;
  mem8[PROJ_OFS_X_HI] = 0x00;
  mem8[DEPTH_HI] = 0xe0;
  mem8[DEPTH_LO] = 0xff;
  {
    const [a, x] = selectPointerPair(m);
    mem8[DRAW_CURSOR_ALT_HI] = a;
    mem8[DRAW_CURSOR_ALT_LO] = x;
  }
  mem8[SLOT_LOOP_INDEX] = 0x0f;
  do {
    const x = mem8[SLOT_LOOP_INDEX];
    const active = mem8[u16(ENEMY_SLOT_FLAGS + x)];
    if (active !== 0) {
      mem8[OBJ_DEPTH] = active;
      mem8[PROJ_PT_Y] = mem8[u16(OBJECT_AXIS1_POS + x)];
      mem8[PROJ_PT_X] = mem8[u16(ENEMY_POS2 + x)];
      projectPointThroughMathbox(m);
      mem8[VG_RECORD_HEADER] = 0x00;
      swapDrawPointers(m);
      emitCoordDeltaRecord(m);
      emitBlankValueRecord(m, 0xa0);
      swapDrawPointers(m);
      emitObjectPositionVector(m, 0x61);
      const [pa, py] = returnConstantTwo(m);
      emitVectorWordTag70(m, pa, py);
      let phase = mem8[SLOT_LOOP_INDEX] & 0x07;
      if (phase === 0x07) phase = 0x00;
      mem8[loc_9e] = phase;
      emitTaggedVectorWord(m, 0x08, phase);
      emitVectorWordTag60FromKey(m, 0x00);
      const [ha, hx] = selectPointerPair(m);
      emitCoordinateVectorWord(m, ha, hx);
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;
  } while (true);
  swapDrawPointers(m);
  loc_df6a(m, 0x01);
  emitRecordBodyC0(m);
  return swapDrawPointers(m);
}
