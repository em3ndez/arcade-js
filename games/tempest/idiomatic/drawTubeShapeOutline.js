// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SAVED_INDEX, SAVED_INDEX2, TABLE_CURSOR, PROJ_PT_Y, OBJ_DEPTH, VG_RECORD_HEADER, loc_9e, TUBE_SHAPE_INDEX,
  LANE_VERTEX_X, LANE_VERTEX_Y, LEVEL_GATE_FLAG, OUTLINE_HEADER,
} from "./names.js";
import { resolveShapeTableIndex } from "./resolveShapeTableIndex.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";

// Reduce an input byte into two scratch fields, emit a framing record, then walk two
// delta tables (16 steps) emitting one vector segment per step.
export function drawTubeShapeOutline(m, a = m.regs.a) {
  const { mem8 } = m;

  const [reduced, quotient] = resolveShapeTableIndex(m, a);
  mem8[SAVED_INDEX2] = reduced;
  mem8[SAVED_INDEX] = quotient;

  mem8[VG_RECORD_HEADER] = 0x00;
  emitBlankVectorWordTag70(m, 0x05);

  const col = mem8[SAVED_INDEX] & 0x07;
  const header = mem8[u16(OUTLINE_HEADER + col)];
  mem8[loc_9e] = header;
  emitTaggedVectorWord(m, 0x08, header);

  const shape = mem8[TUBE_SHAPE_INDEX];
  let seed = mem8[SAVED_INDEX2];
  if (mem8[u16(LEVEL_GATE_FLAG + shape)] === 0) seed = (seed - 0x0f) & 0xff;

  const firstY = mem8[u16(LANE_VERTEX_Y + seed)];
  mem8[OBJ_DEPTH] = firstY;
  const firstX = mem8[u16(LANE_VERTEX_X + seed)];
  mem8[PROJ_PT_Y] = firstX;
  emitScaledCoordinateRecord(m, firstX ^ 0x80, firstY ^ 0x80);

  mem8[VG_RECORD_HEADER] = 0xc0;
  mem8[TABLE_CURSOR] = 0x0f;
  for (;;) {
    const idx = mem8[SAVED_INDEX2];
    const nx = mem8[u16(LANE_VERTEX_X + idx)];
    const dx = (nx - mem8[PROJ_PT_Y]) & 0xff;
    mem8[PROJ_PT_Y] = nx;
    const ny = mem8[u16(LANE_VERTEX_Y + idx)];
    const dy = (ny - mem8[OBJ_DEPTH]) & 0xff;
    mem8[OBJ_DEPTH] = ny;
    emitScaledCoordinateRecord(m, dx, dy);
    mem8[SAVED_INDEX2] = mem8[SAVED_INDEX2] - 1;
    const count = (mem8[TABLE_CURSOR] - 1) & 0xff;
    mem8[TABLE_CURSOR] = count;
    if (count >= 0x80) break;
  }

  emitBlankVectorWordTag70(m, 0x01);
}
