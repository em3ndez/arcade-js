// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, LANE_TARGET_FLAG, LANE_LIMIT, SEG_MID_X, SEG_MID_Y, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X,
  POKEY1_RANDOM, DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, BLANK_SLOT_VEC_LO, BLANK_SLOT_VEC_HI, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI,
} from "./names.js";
import { snapCoordUpToReference } from "./snapCoordUpToReference.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { emitDeltaVectorPair } from "./emitDeltaVectorPair.js";
import { appendNormalizedMantissaExponent } from "./appendNormalizedMantissaExponent.js";

/**
 * emitEnemySlotEntry — emit one enemy slot's vector-list entry, projecting the object and
 * appending its terminator word. ROM 0xc6c7.
 *
 * Role in the machine: Tempest keeps enemies in a table of slots; this routine turns the slot
 * currently addressed by loc_38 into one entry of the vector display list. An empty slot
 * (its depth/kind byte loc_3ac+x is zero) is drawn as four blank placeholder pairs so the
 * list keeps a fixed stride. A live slot is projected through the math-box coprocessor and
 * emitted as delta vectors, then capped with either a randomly chosen template word or a
 * fixed marker word depending on the slot's target flag.
 *
 * Behavior: x = slot cursor loc_38; base = draw pointer loc_74:75. If LANE_LIMIT+x == 0
 * (inactive): from the current cursor offset write four (0x00, 0x71) pairs and store the
 * advanced offset, then return. Otherwise seat the scratch inputs — OBJ_DEPTH = LANE_LIMIT+x,
 * clamp via snapCoordUpToReference (c453), PROJ_PT_Y = SEG_MID_X+x, PROJ_PT_X = SEG_MID_Y+x —
 * project the point through the math box (projectPointThroughMathbox, c098), and emit its
 * delta words (emitDeltaVectorPair, c73c). Then read the target flag: kind = (LANE_TARGET_FLAG
 * + loc_38) & 0x40. If set, append a normalized mantissa/exponent pair (bd3e advances the cursor
 * by two and returns the new offset), then write the two adjacent template words
 * OBJ_TEMPLATE_WORD_LO/HI+idx at that offset and advance by two more -- a four-byte record. If
 * clear, write the fixed marker word (0x00, 0x68, BLANK_SLOT_VEC_LO, BLANK_SLOT_VEC_HI), also four.
 *
 * Live-out: the enemy's projected/marker bytes appended through the draw pointer and the draw
 * cursor offset loc_a9 advanced; the projection scratch fields (OBJ_DEPTH, PROJ_PT_X/Y) and
 * the math-box outputs are also left seated. Grounding: [seen].
 */
export function emitEnemySlotEntry(m) {
  const { mem8 } = m;
  const x = mem8[TABLE_CURSOR];
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);

  if (mem8[u16(LANE_LIMIT + x)] === 0) {
    // Inactive slot: four blank+0x71 pairs from the current cursor.
    let y = mem8[DRAW_CURSOR_OFFSET];
    for (let i = 0; i < 4; i++) {
      mem8[u16(base + y)] = 0x00; y = u8(y + 1);
      mem8[u16(base + y)] = 0x71; y = u8(y + 1);
    }
    mem8[DRAW_CURSOR_OFFSET] = y;
    return;
  }

  // Active slot: seat scratch fields and run the delta/coprocessor passes.
  mem8[OBJ_DEPTH] = mem8[u16(LANE_LIMIT + x)];        // depth = slot's kind byte
  snapCoordUpToReference(m);                          // clamp depth to the reference (c453)
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + x)];         // seat the segment midpoint as the point
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + x)];
  projectPointThroughMathbox(m);                      // math-box projection (c098)
  emitDeltaVectorPair(m);                             // emit the projected delta vectors (c73c)

  const kind = mem8[u16(LANE_TARGET_FLAG + mem8[TABLE_CURSOR])] & 0x40;  // target flag bit6
  if (kind !== 0) {
    // Randomized word: append the mantissa/exponent pair FIRST -- appendNormalizedMantissaExponent writes 2
    // bytes at the cursor and returns the advanced offset ($a9 + 2) WITHOUT storing $a9 back, so the ROM
    // consumes that returned Y for the two template words at [$a9+2, $a9+3] and advances $a9 by 2 more (a
    // 4-byte record). Reusing the pre-call cursor here clobbers the pair and leaves the record 2 bytes short.
    const y = appendNormalizedMantissaExponent(m) & 0xff;
    const idx = (mem8[POKEY1_RANDOM] & 0x02) + 0x1c;
    mem8[u16(base + u8(y + 1))] = mem8[u16(OBJ_TEMPLATE_WORD_HI + idx)];
    mem8[u16(base + y)] = mem8[u16(OBJ_TEMPLATE_WORD_LO + idx)];
    mem8[DRAW_CURSOR_OFFSET] = u8(y + 2);
    return;
  }

  // Fixed marker word.
  let y = mem8[DRAW_CURSOR_OFFSET];
  mem8[u16(base + y)] = 0x00; y = u8(y + 1);
  mem8[u16(base + y)] = 0x68; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[BLANK_SLOT_VEC_LO]; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[BLANK_SLOT_VEC_HI]; y = u8(y + 1);
  mem8[DRAW_CURSOR_OFFSET] = y;
}
