// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, WELL_DEPTH_ROW, VG_LAST_STAT, VG_RECORD_HEADER, SEG_SPREAD_A_LO_3, SEG_SPREAD_A_LO_4,
  SCORE_DISPLAY_TIMER, DEPTH_CEILING, PLAYER_SEGMENT, SLOT_THRESHOLD_TABLE, WELL_SEGMENT_COORD_TABLE, RIM_SEGMENT_ARG_TABLE, WELL_VERTEX_TABLE,
} from "./names.js";
import { loc_ca48 } from "./loc_ca48.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_ab17 } from "./loc_ab17.js";
import { loc_aa92 } from "./loc_aa92.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { loc_af77 } from "./loc_af77.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_b0c6 } from "./loc_b0c6.js";
import { loc_c4e1 } from "./loc_c4e1.js";
import { loc_dfb1 } from "./loc_dfb1.js";
import { loc_b0ab } from "./loc_b0ab.js";

// Draw the whole playfield well: refresh gates, draw the rim segments, nudge the window
// one step toward its target, then draw five depth rows and a four-entry trailer.
export function loc_af81(m) {
  const { mem8 } = m;
  loc_ca48(m);
  mem8[SCORE_DISPLAY_TIMER]--;
  loc_b0d1(m, 0x03);
  mem8[VG_LAST_STAT] = 0x01;
  loc_df6a(m, 0x01);
  loc_ab17(m, 0x60, 0x2c);
  loc_aa92(m);

  // Rim segments: top index down through zero.
  mem8[SLOT_LOOP_INDEX] = 0x07;
  do {
    loc_ab14(m, mem8[u16(RIM_SEGMENT_ARG_TABLE + mem8[SLOT_LOOP_INDEX])]);
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
    loc_b0d1(m, 0x05);
    mem8[VG_RECORD_HEADER] = 0x00;
    loc_ab0d(m);
    loc_df75(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xf8) & 0xff, 0xd8);
    // Skip the row body once the depth value reaches the far edge.
    if (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] < 0x63) {
      loc_af77(m, (mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])] + 1) & 0xff);
      loc_b0d1(m, 0x03);
      loc_ab0d(m);
      loc_df75(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])] + 0xec) & 0xff, 0xba);
      loc_b0c6(m, mem8[WELL_DEPTH_ROW]);
      loc_ab0d(m);
      loc_df75(m, mem8[u16(WELL_SEGMENT_COORD_TABLE + mem8[SLOT_LOOP_INDEX])], 0xcc);
      loc_c4e1(m, mem8[u16(SLOT_THRESHOLD_TABLE + mem8[WELL_DEPTH_ROW])]);
    }
    mem8[WELL_DEPTH_ROW]--;
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);

  // Trailer: a framing draw plus a four-entry table walk.
  mem8[VG_RECORD_HEADER] = 0x00;
  loc_ab0d(m);
  loc_ab14(m, 0x1c);
  loc_dfb1(m, 0x04, 0x01);
  loc_b0d1(m, 0x00);
  loc_ab0d(m);
  const [nudged] = loc_b0ab(m);
  const idx = (nudged - mem8[SEG_SPREAD_A_LO_3]) & 0xff;
  loc_df75(m, (mem8[u16(WELL_SEGMENT_COORD_TABLE + idx)] - 0x16) & 0xff, 0xb8);
  mem8[VG_RECORD_HEADER] = 0xe0;
  mem8[TABLE_CURSOR] = 0x00;
  mem8[SLOT_LOOP_INDEX] = 0x03;
  do {
    const i = mem8[TABLE_CURSOR];
    const xArg = mem8[u16(WELL_VERTEX_TABLE + i)];
    const aArg = mem8[u16(WELL_VERTEX_TABLE + ((i + 1) & 0xff))];
    mem8[TABLE_CURSOR] = i + 2;
    loc_df75(m, aArg, xArg);
    mem8[SLOT_LOOP_INDEX]--;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
}
