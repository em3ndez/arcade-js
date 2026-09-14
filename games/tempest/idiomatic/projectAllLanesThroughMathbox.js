// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, CLAMP_TALLY,
  PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI,
  COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B, SEG_BASE_X, SEG_BASE_Y,
} from "./names.js";

// Sixteen passes: feed each column pair through the delta integrator, then clamp both
// signed results into [-4..+3] (0xfc..0x03), writing the value/sign arrays indexed by
// $38 and tallying every clamp in $59; hands back the clamp count.
export function projectAllLanesThroughMathbox(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[OBJ_DEPTH] = a;
  mem8[TABLE_CURSOR] = x;
  mem8[CLAMP_TALLY] = 0x00;
  mem8[SLOT_LOOP_INDEX] = 0x0f;

  for (;;) {
    const col = mem8[SLOT_LOOP_INDEX];
    mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + col)];
    mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + col)];
    projectPointThroughMathbox(m);

    const out = mem8[TABLE_CURSOR];
    const [v1, s1, c1] = clamp(mem8[PROJ_Y_HI], mem8[PROJ_Y_LO]);
    if (c1) mem8[CLAMP_TALLY] = u8(mem8[CLAMP_TALLY] + 1);
    mem8[u16(COL_VAL_A + out)] = v1;
    mem8[u16(COL_SUB_A + out)] = s1;

    const [v2, s2, c2] = clamp(mem8[PROJ_X_HI], mem8[PROJ_X_LO]);
    if (c2) mem8[CLAMP_TALLY] = u8(mem8[CLAMP_TALLY] + 1);
    mem8[u16(COL_VAL_B + out)] = v2;
    mem8[u16(COL_SUB_B + out)] = s2;

    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);
    const next = u8(mem8[SLOT_LOOP_INDEX] - 1);
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;
  }

  return (m.regs.a = mem8[CLAMP_TALLY]);
}

// Saturate a signed value/sign pair to the [-4..+3] window, reporting whether it clamped.
function clamp(value, sign) {
  if (value & 0x80) {
    if (value < 0xfc) return [0xfc, 0x01, true];
  } else if (value >= 0x04) {
    return [0x03, 0xff, true];
  }
  return [value, sign, false];
}
