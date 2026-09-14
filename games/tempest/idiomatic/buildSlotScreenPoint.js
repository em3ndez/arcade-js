// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_2e, loc_2f, loc_30, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, CLAMP_TALLY, RUN_SIZE,
  TUBE_SHAPE_INDEX, ENEMY_SEGMENT, ENEMY_PHASE, SEG_BASE_X, SEG_BASE_Y,
  VERTEX_Y_OFS_BY_PHASE, VERTEX_X_OFS_BY_PHASE, STYLE_TABLE_59, STYLE_TABLE_5A,
} from "./names.js";

// Signed-saturating add of a delta to a base value, both offset by a 0x80 bias.
function clampAdd(base, delta) {
  const a = base ^ 0x80;
  const res = (a + delta) & 0xff;
  const overflow = (~(a ^ delta) & (a ^ res) & 0x80) !== 0;
  let out = res;
  if (overflow) out = res & 0x80 ? 0x7f : 0x80;   // clamp toward the sign that overflowed
  return (out ^ 0x80) & 0xff;
}

// Build a screen point (x=$2e, y=$30) for slot x: fetch a base coord pair, offset each by a signed
// table delta with saturation, and load a paired style byte pair into $59/$5a.
export function buildSlotScreenPoint(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_2f] = mem8[OBJ_DEPTH];
  const coordIdx = mem8[u16(ENEMY_SEGMENT + x)];
  mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + coordIdx)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + coordIdx)];
  const deltaIdx = mem8[u16(ENEMY_PHASE + x)] & 0x0f;
  mem8[loc_2e] = clampAdd(mem8[PROJ_PT_Y], mem8[u16(VERTEX_X_OFS_BY_PHASE + deltaIdx)]);
  mem8[loc_30] = clampAdd(mem8[PROJ_PT_X], mem8[u16(VERTEX_Y_OFS_BY_PHASE + deltaIdx)]);
  const styleIdx = mem8[TUBE_SHAPE_INDEX];
  mem8[CLAMP_TALLY] = mem8[u16(STYLE_TABLE_59 + styleIdx)];
  mem8[RUN_SIZE] = mem8[u16(STYLE_TABLE_5A + styleIdx)];
}
