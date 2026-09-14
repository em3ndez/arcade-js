// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { resolveShapeTableIndex } from "./resolveShapeTableIndex.js";
import {
  GAME_MODE_PENDING, loc_3d, PLAYER_LEVEL_TBL, DEPTH_LO, DEPTH_TARGET, DEPTH_HI, PROJ_X_REF, PROJ_OFS_Y_LO, PROJ_OFS_Y_HI,
  PROJ_OFS_X_LO, PROJ_OFS_X_HI, loc_a0, loc_10f, loc_110, TUBE_GEOM_FLAG, TUBE_SHAPE_INDEX, loc_113, LEVEL_GEOM_SCALE,
  COL_VAL_A, COL_VAL_B, LANE_TARGET_FLAG, SEG_BASE_X, SEG_BASE_Y, SEG_DIRECTION, SEG_MID_X, SEG_MID_Y,
  LANE_VERTEX_X, LANE_VERTEX_Y, LANE_RING_DIR, LEVEL_TUBE_DEPTH, LEVEL_PARAM_LOC60, LEVEL_OFFSET_LO, LEVEL_OFFSET_HI, LEVEL_GATE_FLAG,
} from "./names.js";

/**
 * buildTubeLaneCoords — lay out the current level's tube geometry. ROM 0xc235.
 *
 * Role in the machine: Tempest plays down a tube made of 16 lanes (segments) that fan out from a
 * vanishing point. This routine builds the per-lane coordinate arrays that everything else — the
 * player's shooter, the enemies climbing the walls, the projectiles — reads to position itself. It
 * turns the current level's shape (selected by loc_3d through the level table) into concrete vertex,
 * direction, and midpoint cells for all 16 columns.
 *
 * Behavior: it reduces the level's shape byte (PLAYER_LEVEL_TBL indexed by loc_3d) through
 * resolveShapeTableIndex to get the starting vertex row `seed`, and reads the shape row `y` from
 * TUBE_SHAPE_INDEX. From the level tables at row `y` it derives the depth/span cells: the negated
 * LEVEL_TUBE_DEPTH into DEPTH_HI and DEPTH_TARGET, 0x10-minus-that into loc_a0, DEPTH_LO=0xff, the
 * projection reference PROJ_X_REF, and the geometry flag TUBE_GEOM_FLAG. The x-offset pair is either
 * copied straight from the level tables (GAME_MODE_PENDING==0x1e) or computed as a signed 16-bit
 * difference against the current PROJ_OFS_X pair and shifted right four times, the low byte landing in
 * LEVEL_GEOM_SCALE. It then clears the y-offset/scratch cells and sets loc_113=0x2c. Two loops finish
 * the layout: the first seeds six per-column arrays (SEG_BASE_X/Y, COL_VAL_A/B, LANE_TARGET_FLAG,
 * SEG_DIRECTION) from the ROM vertex tables, the neighbour index `ny` walking down from `seed`; the
 * second rounding-averages each column with its next wrapping neighbour into SEG_MID_X/Y.
 *
 * Live-out: the depth/span cells (DEPTH_HI/LO/TARGET, loc_a0, PROJ_X_REF, TUBE_GEOM_FLAG), the offset
 * pair / LEVEL_GEOM_SCALE, the six per-column arrays, and the two midpoint arrays SEG_MID_X/Y — the
 * full tube geometry for this level. Grounding: [seen].
 */
export function buildTubeLaneCoords(m) {
  const { mem8 } = m;
  // Reduce the level's shape byte to a starting vertex row, and read the shape row index.
  const seed = resolveShapeTableIndex(m, mem8[u8(PLAYER_LEVEL_TBL + mem8[loc_3d])])[0];
  const y = mem8[TUBE_SHAPE_INDEX];

  // Derive the depth/span cells from the level tables at row y.
  const neg = u8(-mem8[u16(LEVEL_TUBE_DEPTH + y)]);    // negated tube depth
  mem8[DEPTH_HI] = neg;
  mem8[DEPTH_TARGET] = neg;
  mem8[loc_a0] = u8(0x10 - neg);                       // complement to a full step
  mem8[DEPTH_LO] = 0xff;
  mem8[PROJ_X_REF] = mem8[u16(LEVEL_PARAM_LOC60 + y)]; // projection reference
  mem8[TUBE_GEOM_FLAG] = mem8[u16(LEVEL_GATE_FLAG + y)];

  if (mem8[GAME_MODE_PENDING] === 0x1e) {
    // Copy the offset pair straight from the level tables.
    mem8[PROJ_OFS_X_LO] = mem8[u16(LEVEL_OFFSET_LO + y)];
    mem8[PROJ_OFS_X_HI] = mem8[u16(LEVEL_OFFSET_HI + y)];
  } else {
    // signed 16-bit difference {bcbc:bcac} - {$69:$68}, then >> 4 keeping the low byte
    const diffLo = mem8[u16(LEVEL_OFFSET_LO + y)] - mem8[PROJ_OFS_X_LO];
    const carry = diffLo >= 0 ? 1 : 0;                 // borrow flag from the low subtract
    let low = diffLo & 0xff;
    let high = (mem8[u16(LEVEL_OFFSET_HI + y)] - mem8[PROJ_OFS_X_HI] - (1 - carry)) & 0xff;
    for (let i = 0; i < 4; i++) {                      // >> 4, feeding the high bit down into low
      const bit = high & 0x01;
      high >>= 1;
      low = ((bit << 7) | (low >> 1)) & 0xff;
    }
    mem8[LEVEL_GEOM_SCALE] = low;                      // scaled offset low byte
  }

  // Clear the y-offset and scratch cells; set the fixed geometry constant.
  mem8[PROJ_OFS_Y_LO] = 0x00;
  mem8[PROJ_OFS_Y_HI] = 0x00;
  mem8[loc_10f] = 0x00;
  mem8[loc_110] = 0x00;
  mem8[loc_113] = 0x2c;

  // Seed six per-column arrays top-down; the neighbour index walks down from `seed`.
  let ny = seed;
  for (let x = 0x0f; x >= 0; x--) {
    mem8[u16(SEG_BASE_X + x)] = mem8[u16(LANE_VERTEX_X + ny)];  // lane vertex X from ROM
    mem8[u16(SEG_BASE_Y + x)] = mem8[u16(LANE_VERTEX_Y + ny)];  // lane vertex Y from ROM
    mem8[u16(COL_VAL_A + x)] = 0x00;
    mem8[u16(COL_VAL_B + x)] = 0x00;
    mem8[u16(LANE_TARGET_FLAG + x)] = 0x00;
    mem8[u16(SEG_DIRECTION + x)] = mem8[u16(LANE_RING_DIR + ny)]; // ring-direction from ROM
    ny = u8(ny - 1);                                   // step to the previous vertex row
  }

  // Rounding-average each column with its next neighbour (wrapping) into two arrays.
  for (let x = 0x0f; x >= 0; x--) {
    const nx = (x + 1) & 0x0f;                         // next column, wrapping 15->0
    mem8[u16(SEG_MID_X + x)] = avg(mem8[u16(SEG_BASE_X + nx)], mem8[u16(SEG_BASE_X + x)]);
    mem8[u16(SEG_MID_Y + x)] = avg(mem8[u16(SEG_BASE_Y + nx)], mem8[u16(SEG_BASE_Y + x)]);
  }
}

// Add two bytes plus one, then rotate right carrying the ninth bit into bit 7.
function avg(a, b) {
  const sum = a + b + 1;
  const cout = sum > 0xff ? 0x80 : 0x00;              // ninth-bit carry rotated into bit 7
  return (cout | ((sum & 0xff) >> 1)) & 0xff;
}
