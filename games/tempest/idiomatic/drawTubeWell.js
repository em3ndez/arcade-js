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

/**
 * drawTubeWell — render the whole tube playfield for one frame. ROM 0xaf81.
 *
 * Role in the machine: Tempest is played down the throat of a tube (the "well"). Every frame this is
 * the routine that draws that tube: the rim ring the player's blaster rides, the receding depth rings
 * that give the shaft its perspective, the per-segment depth labels, and the closing frame geometry.
 * It also keeps the tube's visual "window" — the pair of low bytes that pans the shaft toward where
 * the action is — creeping one step per frame toward its target so the view follows the player.
 *
 * Behavior, stage by stage:
 *   1. Refresh projection/scale gates (selectProjectionScale) and tick the SCORE_DISPLAY_TIMER down.
 *   2. Seed the draw stream: a colour stat, VG_LAST_STAT, a blank $70 vector word, and a header slot
 *      shape plus its digit run — the fixed preamble every tube frame opens with.
 *   3. Rim ring: walk SLOT_LOOP_INDEX from 7 down through 0 (the `< 0x80` guard catches the wrap past
 *      0), drawing each rim segment from RIM_SEGMENT_ARG_TABLE.
 *   4. Window nudge: move the depth-window pair SEG_SPREAD_A_LO_3 / SEG_SPREAD_A_LO_4 one step toward
 *      target PLAYER_SEGMENT. Sign of the delta chooses direction; the DEPTH_CEILING and a
 *      past-the-target test decide whether the window steps closer, settles, or backs off (with an
 *      underflow guard when it steps below zero).
 *   5. Depth rows: seed WELL_DEPTH_ROW from the window, then draw five rings deepest-first
 *      (SLOT_LOOP_INDEX 4..0). Each ring emits a scaled coordinate; rings whose SLOT_THRESHOLD_TABLE
 *      depth has not yet reached the far edge (< 0x63) also draw the depth label (emitByteAsBcdDigits),
 *      a second coordinate, the table-value digit run, and the tube outline (drawTubeShapeOutline).
 *   6. Trailer: a framing draw, a short nibble digit run, then a scaled coordinate placed relative to
 *      the freshly nudged blaster rim position (nudgeBlasterRimPosition), and finally a four-entry walk
 *      over WELL_VERTEX_TABLE that emits the closing frame vertices (TABLE_CURSOR steps by two).
 *
 * Live-out: a full frame's worth of vector records in the draw stream; the panned window pair
 * SEG_SPREAD_A_LO_3 / SEG_SPREAD_A_LO_4; WELL_DEPTH_ROW, SLOT_LOOP_INDEX, TABLE_CURSOR, VG_RECORD_HEADER
 * and VG_LAST_STAT left as scratch; SCORE_DISPLAY_TIMER decremented. Grounding: [seen].
 */
export function drawTubeWell(m) {
  const { mem8 } = m;
  selectProjectionScale(m);              // refresh the projection/scale gates for this frame
  mem8[SCORE_DISPLAY_TIMER]--;           // tick the score-display timer
  emitColorStatIfChanged(m, 0x03);       // open the draw stream with a colour stat...
  mem8[VG_LAST_STAT] = 0x01;
  emitBlankVectorWordTag70(m, 0x01);     // ...a blank $70 vector word...
  drawSlotShapeWithHeader(m, 0x60, 0x2c);// ...and the header slot shape + its digit run
  drawSlotThenDigitRun(m);

  // Rim ring: top index down through zero (the `< 0x80` test catches the wrap past 0).
  mem8[SLOT_LOOP_INDEX] = 0x07;
  do {
    drawSlotShapeRecord(m, mem8[u16(RIM_SEGMENT_ARG_TABLE + mem8[SLOT_LOOP_INDEX])]);
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);

  // Window nudge: pan the depth-window pair one step toward target PLAYER_SEGMENT.
  {
    const target = mem8[PLAYER_SEGMENT];
    const delta = (target - mem8[SEG_SPREAD_A_LO_3]) & 0xff;  // signed distance to target
    if ((delta & 0x80) === 0) {           // target is at or above the window (non-negative delta)
      if (delta !== 0) {
        const cur = mem8[SEG_SPREAD_A_LO_4];
        // Past the ceiling settles; at or below it steps one closer to the target.
        let settle = cur > mem8[DEPTH_CEILING];
        if (!settle) {
          const back = (cur - target) & 0xff;
          settle = back !== 0 ? cur >= target : false;
          if (!settle) {
            mem8[SEG_SPREAD_A_LO_3]++;     // step the window one closer
            mem8[SEG_SPREAD_A_LO_4]++;
          }
        }
      } else {                            // already on target: pull the window in by one...
        mem8[SEG_SPREAD_A_LO_4]--;
        mem8[SEG_SPREAD_A_LO_3]--;
        if ((mem8[SEG_SPREAD_A_LO_3] & 0x80) !== 0) {  // ...but undo if that underflowed below zero
          mem8[SEG_SPREAD_A_LO_3]++;
          mem8[SEG_SPREAD_A_LO_4]++;
        }
      }
    } else {                              // target is below the window: step it down
      mem8[SEG_SPREAD_A_LO_3]--;
      mem8[SEG_SPREAD_A_LO_4]--;
    }
  }

  // Five depth rings, deepest first (SLOT_LOOP_INDEX 4..0).
  mem8[WELL_DEPTH_ROW] = mem8[SEG_SPREAD_A_LO_4];  // seed the depth cursor from the window
  mem8[SLOT_LOOP_INDEX] = 0x04;
  do {
    emitColorStatIfChanged(m, 0x05);      // colour stat for this ring
    mem8[VG_RECORD_HEADER] = 0x00;
    emitFixedVectorWord(m);
    // Ring coordinate, offset back (0xf8) from this segment's tube-well coordinate.
    emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xf8) & 0xff, 0xd8);
    // Draw the labelled row body only until this ring's depth reaches the far edge (>= 0x63).
    if (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] < 0x63) {
      // Depth label: this ring's threshold value + 1, drawn as two decimal digits.
      emitByteAsBcdDigits(m, (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] + 1) & 0xff);
      emitColorStatIfChanged(m, 0x03);
      emitFixedVectorWord(m);
      // Label coordinate, offset (0xec) from the segment coordinate.
      emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xec) & 0xff, 0xba);
      emitTableValueDigitRun(m, mem8[WELL_DEPTH_ROW]);   // trailing digit run for the row
      emitFixedVectorWord(m);
      emitScaledCoordinateRecord(m, mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])], 0xcc);
      drawTubeShapeOutline(m, mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])]);  // the ring outline
    }
    mem8[WELL_DEPTH_ROW]--;                // recede one ring deeper
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);  // until the ring counter wraps past 0

  // Trailer: a framing draw, a short digit run, a blaster-relative coordinate, then the frame vertices.
  mem8[VG_RECORD_HEADER] = 0x00;
  emitFixedVectorWord(m);
  drawSlotShapeRecord(m, 0x1c);
  emitNibbleDigitRun(m, 0x04, 0x01);
  emitColorStatIfChanged(m, 0x00);
  emitFixedVectorWord(m);
  const [nudged] = nudgeBlasterRimPosition(m);          // advance the blaster's rim position...
  const idx = (nudged - mem8[SEG_SPREAD_A_LO_3]) & 0xff; // ...and index the well coord relative to the window
  emitScaledCoordinateRecord(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + idx)] - 0x16) & 0xff, 0xb8);
  mem8[VG_RECORD_HEADER] = 0xe0;          // closing frame uses the $e0 record header
  mem8[TABLE_CURSOR] = 0x00;
  mem8[SLOT_LOOP_INDEX] = 0x03;
  do {
    const i = mem8[TABLE_CURSOR];         // vertices are packed as (x, a) pairs
    const xArg = mem8[u16(WELL_VERTEX_TABLE + i)];
    const aArg = mem8[u16(WELL_VERTEX_TABLE + ((i + 1) & 0xff))];
    mem8[TABLE_CURSOR] = i + 2;           // step to the next pair
    emitScaledCoordinateRecord(m, aArg, xArg);
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80); // four vertices, then wrap past 0
}
