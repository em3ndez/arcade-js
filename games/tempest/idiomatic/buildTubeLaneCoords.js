// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { resolveShapeTableIndex } from "./resolveShapeTableIndex.js";
import {
  GAME_MODE_PENDING, loc_3d, PLAYER_LEVEL_TBL, DEPTH_LO, DEPTH_TARGET, DEPTH_HI, PROJ_X_REF, PROJ_OFS_Y_LO, PROJ_OFS_Y_HI,
  PROJ_OFS_X_LO, PROJ_OFS_X_HI, loc_a0, loc_10f, loc_110, TUBE_GEOM_FLAG, TUBE_SHAPE_INDEX, loc_113, LEVEL_GEOM_SCALE,
  COL_VAL_A, COL_VAL_B, LANE_TARGET_FLAG, SEG_BASE_X, SEG_BASE_Y, SEG_DIRECTION, SEG_MID_X, SEG_MID_Y,
  LANE_VERTEX_X, LANE_VERTEX_Y, LANE_RING_DIR, LEVEL_TUBE_DEPTH, LEVEL_PARAM_LOC60, LEVEL_OFFSET_LO, LEVEL_OFFSET_HI, LEVEL_GATE_FLAG,
} from "./names.js";

// Level-geometry setup: reduce the selected slot, derive the span cells from the
// level tables, fold the offset pair (copy or 4-step shift-right difference), then
// seed the six per-column arrays and average adjacent neighbours into two more.
export function buildTubeLaneCoords(m) {
  const { mem8 } = m;
  const seed = resolveShapeTableIndex(m, mem8[u8(PLAYER_LEVEL_TBL + mem8[loc_3d])])[0];
  const y = mem8[TUBE_SHAPE_INDEX];

  const neg = u8(-mem8[u16(LEVEL_TUBE_DEPTH + y)]);
  mem8[DEPTH_HI] = neg;
  mem8[DEPTH_TARGET] = neg;
  mem8[loc_a0] = u8(0x10 - neg);
  mem8[DEPTH_LO] = 0xff;
  mem8[PROJ_X_REF] = mem8[u16(LEVEL_PARAM_LOC60 + y)];
  mem8[TUBE_GEOM_FLAG] = mem8[u16(LEVEL_GATE_FLAG + y)];

  if (mem8[GAME_MODE_PENDING] === 0x1e) {
    mem8[PROJ_OFS_X_LO] = mem8[u16(LEVEL_OFFSET_LO + y)];
    mem8[PROJ_OFS_X_HI] = mem8[u16(LEVEL_OFFSET_HI + y)];
  } else {
    // signed 16-bit difference {bcbc:bcac} - {$69:$68}, then >> 4 keeping the low byte
    const diffLo = mem8[u16(LEVEL_OFFSET_LO + y)] - mem8[PROJ_OFS_X_LO];
    const carry = diffLo >= 0 ? 1 : 0;
    let low = diffLo & 0xff;
    let high = (mem8[u16(LEVEL_OFFSET_HI + y)] - mem8[PROJ_OFS_X_HI] - (1 - carry)) & 0xff;
    for (let i = 0; i < 4; i++) {
      const bit = high & 0x01;
      high >>= 1;
      low = ((bit << 7) | (low >> 1)) & 0xff;
    }
    mem8[LEVEL_GEOM_SCALE] = low;
  }

  mem8[PROJ_OFS_Y_LO] = 0x00;
  mem8[PROJ_OFS_Y_HI] = 0x00;
  mem8[loc_10f] = 0x00;
  mem8[loc_110] = 0x00;
  mem8[loc_113] = 0x2c;

  // Seed six per-column arrays top-down; the neighbour index walks down from `seed`.
  let ny = seed;
  for (let x = 0x0f; x >= 0; x--) {
    mem8[u16(SEG_BASE_X + x)] = mem8[u16(LANE_VERTEX_X + ny)];
    mem8[u16(SEG_BASE_Y + x)] = mem8[u16(LANE_VERTEX_Y + ny)];
    mem8[u16(COL_VAL_A + x)] = 0x00;
    mem8[u16(COL_VAL_B + x)] = 0x00;
    mem8[u16(LANE_TARGET_FLAG + x)] = 0x00;
    mem8[u16(SEG_DIRECTION + x)] = mem8[u16(LANE_RING_DIR + ny)];
    ny = u8(ny - 1);
  }

  // Rounding-average each column with its next neighbour (wrapping) into two arrays.
  for (let x = 0x0f; x >= 0; x--) {
    const nx = (x + 1) & 0x0f;
    mem8[u16(SEG_MID_X + x)] = avg(mem8[u16(SEG_BASE_X + nx)], mem8[u16(SEG_BASE_X + x)]);
    mem8[u16(SEG_MID_Y + x)] = avg(mem8[u16(SEG_BASE_Y + nx)], mem8[u16(SEG_BASE_Y + x)]);
  }
}

// Add two bytes plus one, then rotate right carrying the ninth bit into bit 7.
function avg(a, b) {
  const sum = a + b + 1;
  const cout = sum > 0xff ? 0x80 : 0x00;
  return (cout | ((sum & 0xff) >> 1)) & 0xff;
}
