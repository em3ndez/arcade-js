// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, WELL_DEPTH_ROW, VG_LAST_STAT, VG_RECORD_HEADER, SEG_SPREAD_A_LO_3, SEG_SPREAD_A_LO_4,
  SCORE_DISPLAY_TIMER, DEPTH_CEILING, PLAYER_SEGMENT, SLOT_THRESHOLD_TABLE, WELL_SEGMENT_COORD_TABLE, RIM_SEGMENT_ARG_TABLE, WELL_VERTEX_TABLE,
} from "./names.js";
import { selectProjectionScale } from "./selectProjectionScale.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { drawSlotThenDigitRun } from "./drawSlotThenDigitRun.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitTableValueDigitRun } from "./emitTableValueDigitRun.js";
import { drawTubeShapeOutline } from "./drawTubeShapeOutline.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";
import { nudgeBlasterRimPosition } from "./nudgeBlasterRimPosition.js";

// Draw the whole playfield well: refresh gates, draw the rim segments, nudge the window
// one step toward its target, then draw five depth rows and a four-entry trailer.
export function drawTubeWell(m) {
  const { mem8 } = m;
  selectProjectionScale(m);
  mem8[SCORE_DISPLAY_TIMER]--;
  emitColorStatIfChanged(m, 0x03);
  mem8[VG_LAST_STAT] = 0x01;
  emitBlankVectorWordTag70(m, 0x01);
  drawSlotShapeWithHeader(m, 0x60, 0x2c);
  drawSlotThenDigitRun(m);

  // Rim segments: top index down through zero.
  mem8[SLOT_LOOP_INDEX] = 0x07;
  do {
    drawSlotShapeRecord(m, mem8[u16(RIM_SEGMENT_ARG_TABLE + mem8[SLOT_LOOP_INDEX])]);
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);

  // Nudge the window pair one step toward its target.
  {
    const target = mem8[PLAYER_SEGMENT];
    const delta = (target - mem8[SEG_SPREAD_A_LO_3]) & 0xff;
    if ((delta & 0x80) === 0) {
      if (delta !== 0) {
        const cur = mem8[SEG_SPREAD_A_LO_4];
        // Past the ceiling settles; at or below it steps one closer to the target.
        let settle = cur > mem8[DEPTH_CEILING];
        if (!settle) {
          const back = (cur - target) & 0xff;
          settle = back !== 0 ? cur >= target : false;
          if (!settle) {
            mem8[SEG_SPREAD_A_LO_3]++;
            mem8[SEG_SPREAD_A_LO_4]++;
          }
        }
      } else {
        mem8[SEG_SPREAD_A_LO_4]--;
        mem8[SEG_SPREAD_A_LO_3]--;
        if ((mem8[SEG_SPREAD_A_LO_3] & 0x80) !== 0) {
          mem8[SEG_SPREAD_A_LO_3]++;
          mem8[SEG_SPREAD_A_LO_4]++;
        }
      }
    } else {
      mem8[SEG_SPREAD_A_LO_3]--;
      mem8[SEG_SPREAD_A_LO_4]--;
    }
  }

  // Five depth rows, deepest first.
  mem8[WELL_DEPTH_ROW] = mem8[SEG_SPREAD_A_LO_4];
  mem8[SLOT_LOOP_INDEX] = 0x04;
  do {
    emitColorStatIfChanged(m, 0x05);
    mem8[VG_RECORD_HEADER] = 0x00;
    emitFixedVectorWord(m);
    emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xf8) & 0xff, 0xd8);
    // Skip the row body once the depth value reaches the far edge.
    if (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] < 0x63) {
      emitByteAsBcdDigits(m, (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] + 1) & 0xff);
      emitColorStatIfChanged(m, 0x03);
      emitFixedVectorWord(m);
      emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xec) & 0xff, 0xba);
      emitTableValueDigitRun(m, mem8[WELL_DEPTH_ROW]);
      emitFixedVectorWord(m);
      emitScaledCoordinateRecord(m, mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])], 0xcc);
      drawTubeShapeOutline(m, mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])]);
    }
    mem8[WELL_DEPTH_ROW]--;
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);

  // Trailer: a framing draw plus a four-entry table walk.
  mem8[VG_RECORD_HEADER] = 0x00;
  emitFixedVectorWord(m);
  drawSlotShapeRecord(m, 0x1c);
  emitNibbleDigitRun(m, 0x04, 0x01);
  emitColorStatIfChanged(m, 0x00);
  emitFixedVectorWord(m);
  const [nudged] = nudgeBlasterRimPosition(m);
  const idx = (nudged - mem8[SEG_SPREAD_A_LO_3]) & 0xff;
  emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + idx)] - 0x16) & 0xff, 0xb8);
  mem8[VG_RECORD_HEADER] = 0xe0;
  mem8[TABLE_CURSOR] = 0x00;
  mem8[SLOT_LOOP_INDEX] = 0x03;
  do {
    const i = mem8[TABLE_CURSOR];
    const xArg = mem8[u16(WELL_VERTEX_TABLE + i)];
    const aArg = mem8[u16(WELL_VERTEX_TABLE + ((i + 1) & 0xff))];
    mem8[TABLE_CURSOR] = i + 2;
    emitScaledCoordinateRecord(m, aArg, xArg);
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
}
