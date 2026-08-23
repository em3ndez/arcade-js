// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_0010 } from "./loc_0010.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  ROPE_SEGMENT_COUNT, ROUND_COUNTER, DIFFICULTY_DSW, FORMATION_TABLE,
  RETRACT_ANIM_TABLE, ROPE_RETRACT_TILE_SRC,
} from "./names.js";
/**
 * retractRopeSegment — rope-cell state-4 handler: retract one rope segment (dispatched by the per-cell
 * dispatcher with the cell record in IX). Fires only when the cell's frame timer expires and segments
 * remain: pick a retract-anim pointer (round>>2 clamped to 3, plus the difficulty bit-2 term), read
 * this segment's attribute and merge it into the timer cell (unless the cell is the terminal 0x28
 * column), clear the count-selected formation record, advance the cell state, and blit the 2x2
 * segment tile to its column. LIVE-OUT: none (void handler; RAM/VRAM only).
 */

const ANIM_ROW_CLAMP = 3;
const SEG_ATTR_CLAMP = 0x1f;
const RECORD_STRIDE = 0x18;
const TERMINAL_COLUMN = 0x28;
const ATTR_MERGE_MASK = 0x1c;

export function retractRopeSegment(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const [timer, expired] = tickRopeCellFrameTimer(m, rec & 0xff);
  if (!expired) return;
  if (mem8[ROPE_SEGMENT_COUNT] === 0) return;

  const row = Math.min(mem8[ROUND_COUNTER] >> 2, ANIM_ROW_CLAMP);
  const animPtr = loc_0c45(m, ((mem8[DIFFICULTY_DSW] & 0x04) >> 1) + row, RETRACT_ANIM_TABLE);
  const seg = Math.min((mem8[ROPE_SEGMENT_COUNT] - 1) & 0xff, SEG_ATTR_CLAMP);
  const [attr] = loc_0020(m, animPtr, seg);

  let merged = attr;
  if ((timer & 0xff) !== TERMINAL_COLUMN) {
    merged = (mem8[timer - 2] & ATTR_MERGE_MASK) + attr; // carry the paired cell's bits
  }
  mem8[timer] = merged;

  const iterations = ((mem8[u16(timer + 1)] + 1) & 0xff) || 256; // djnz: 0 wraps to 256
  loc_0010(m, u16(FORMATION_TABLE + RECORD_STRIDE * iterations), 0, RECORD_STRIDE);

  mem8[rec] = 1;
  blit2x2TileBlock(m, computeRopeCellVramColumn(m, rec & 0xff), ROPE_RETRACT_TILE_SRC);
}
