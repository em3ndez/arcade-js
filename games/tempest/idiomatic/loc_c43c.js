// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI } from "./names.js";

// Read the current slot index and copy that column of four parallel tables into the working block.
export function loc_c43c(m) {
  const { mem8 } = m;
  const x = mem8[SLOT_LOOP_INDEX];
  mem8[PROJ_Y_LO] = mem8[u16(OBJ_DY_LO + x)];
  mem8[PROJ_Y_HI] = mem8[u16(OBJ_DY_HI + x)];
  mem8[PROJ_X_LO] = mem8[u16(OBJ_DX_LO + x)];
  mem8[PROJ_X_HI] = mem8[u16(OBJ_DX_HI + x)];
  return;
}
