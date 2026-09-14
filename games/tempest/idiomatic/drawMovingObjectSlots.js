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
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";
import { emitRecordBodyC0 } from "./emitRecordBodyC0.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { swapDrawPointers } from "./swapDrawPointers.js";
import { returnConstantTwo } from "./returnConstantTwo.js";
import { selectPointerPair } from "./selectPointerPair.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";
import { emitObjectPositionVector } from "./emitObjectPositionVector.js";

/**
 * drawMovingObjectSlots — draw the 16-slot moving-object cascade into the display list. ROM 0xb8ba.
 *
 * Role in the machine: Tempest tracks up to 16 moving objects (the enemies moving through the tube —
 * flippers, tankers, and the like) in parallel slot arrays. Each frame this walks all 16 slots from the
 * top down, projects every active object's tube position through the math-box into screen space, and
 * emits its vector record — glyph body plus a "shadow" pass laid down with the pointer pair swapped —
 * so the object appears at the right depth on the rim. It is the per-frame enemy-render driver.
 *
 * Behavior: it opens with a framing coordinate word (0x3f,0xf2) and resets the delta integrators
 * (PREV_Y/PREV_X lo/hi = 0, PLAYER_SHOT_DEPTH = 0, PROJ_OFS_X lo/hi = 0) and the depth seed
 * DEPTH_HI/DEPTH_LO = 0xe0ff. It caches the base draw-struct pointer pair from selectPointerPair into
 * DRAW_CURSOR_ALT_HI/LO. Then it counts SLOT_LOOP_INDEX from 0x0f down. For each slot it reads the
 * activity/flag byte ENEMY_SLOT_FLAGS[x]; if nonzero it loads OBJ_DEPTH from that flag and the object's
 * position from OBJECT_AXIS1_POS[x] (into PROJ_PT_Y) and ENEMY_POS2[x] (into PROJ_PT_X), projects the
 * point (projectPointThroughMathbox), zeroes the VG header, and emits the record body between two
 * swapDrawPointers shadow passes: emitCoordDeltaRecord + emitBlankValueRecord(0xa0) on the swapped
 * pointer, then emitObjectPositionVector(0x61) and a tag-70 word (from returnConstantTwo) on the base.
 * It derives an 8-phase animation index from the low 3 bits of the slot (mapping phase 7 -> 0), stores
 * it in loc_9e, and emits the tagged word (0x08, phase) plus a tag-60 word; it then re-caches the
 * pointer pair and lays the next framing coord word. The loop decrements the slot index and stops when
 * it wraps below 0 (bit 7 set). It closes by swapping pointers back, emitting a blank tag-70 word and
 * the C0 record body, and swapping pointers a final time (its return value).
 *
 * Live-out: the delta integrators / depth seed reset for this frame; DRAW_CURSOR_ALT_HI/LO cached;
 * loc_9e holding the last slot's animation phase; and one vector record per active slot (plus the
 * closing framing records) appended to the display list. Grounding: [seen].
 */
export function drawMovingObjectSlots(m) {
  const { mem8 } = m;
  emitCoordinateVectorWord(m, 0x3f, 0xf2); // opening framing word
  // Reset the delta integrators and offset accumulators for this frame.
  mem8[PREV_Y_LO] = 0x00;
  mem8[PREV_Y_HI] = 0x00;
  mem8[PREV_X_LO] = 0x00;
  mem8[PREV_X_HI] = 0x00;
  mem8[PLAYER_SHOT_DEPTH] = 0x00;
  mem8[PROJ_OFS_X_LO] = 0x00;
  mem8[PROJ_OFS_X_HI] = 0x00;
  mem8[DEPTH_HI] = 0xe0; // depth seed hi
  mem8[DEPTH_LO] = 0xff; // depth seed lo
  {
    // Cache the base draw-struct pointer pair for the shadow-pass swaps below.
    const [a, x] = selectPointerPair(m);
    mem8[DRAW_CURSOR_ALT_HI] = a;
    mem8[DRAW_CURSOR_ALT_LO] = x;
  }
  mem8[SLOT_LOOP_INDEX] = 0x0f; // walk slots 0x0f..0x00 from the top down
  do {
    const x = mem8[SLOT_LOOP_INDEX];
    const active = mem8[u16(ENEMY_SLOT_FLAGS + x)]; // slot activity/flag byte
    if (active !== 0) {
      mem8[OBJ_DEPTH] = active;                      // flag doubles as the depth
      mem8[PROJ_PT_Y] = mem8[u16(OBJECT_AXIS1_POS + x)]; // object position, axis 1
      mem8[PROJ_PT_X] = mem8[u16(ENEMY_POS2 + x)];       // object position, axis 2
      projectPointThroughMathbox(m);                 // tube -> screen space
      mem8[VG_RECORD_HEADER] = 0x00;
      swapDrawPointers(m);                           // shadow pass: swap to the alternate pointer
      emitCoordDeltaRecord(m);
      emitBlankValueRecord(m, 0xa0);
      swapDrawPointers(m);                           // back to the base pointer
      emitObjectPositionVector(m, 0x61);
      const [pa, py] = returnConstantTwo(m);
      emitVectorWordTag70(m, pa, py);
      // 8-phase animation index from the low 3 bits of the slot (phase 7 folds to 0).
      let phase = mem8[SLOT_LOOP_INDEX] & 0x07;
      if (phase === 0x07) phase = 0x00;
      mem8[loc_9e] = phase;
      emitTaggedVectorWord(m, 0x08, phase);
      emitVectorWordTag60FromKey(m, 0x00);
      const [ha, hx] = selectPointerPair(m);         // re-cache and lay the next framing word
      emitCoordinateVectorWord(m, ha, hx);
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;                          // stop when the index wraps below 0
  } while (true);
  swapDrawPointers(m);                               // restore pointer orientation
  emitBlankVectorWordTag70(m, 0x01);                 // closing framing records
  emitRecordBodyC0(m);
  return swapDrawPointers(m);
}
