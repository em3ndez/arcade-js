// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI } from "./names.js";

/**
 * loadSlotCoordBlock — gather one object's coordinate column into the working block. ROM 0xc43c.
 *
 * Role in the machine: Tempest keeps the moving objects' coordinates in four parallel
 * arrays indexed by slot -- a low and high byte for each of the X and Y axes ($36a/$35a
 * for Y, $38a/$37a for X on the real board). A per-object routine wants to work on one
 * object at a time out of a fixed scratch block; this reads the slot index the outer loop
 * is currently on and copies that object's four coordinate bytes out of the arrays into
 * the working coordinate cells ($61-$64), so downstream math reads/writes plain cells
 * instead of indexed ones.
 *
 * Behavior: loads the current slot index from $37 into x, then does four indexed reads at
 * that column -- Y-lo, Y-hi, X-lo, X-hi -- storing each into the matching working cell.
 * No loop, no branches; a straight four-field copy of one array column.
 *
 * Live-out: the working coordinate block PROJ_Y_LO/HI and PROJ_X_LO/HI ($61-$64), set to
 * the coordinates of the slot selected by SLOT_LOOP_INDEX. Grounding: [seen].
 */
export function loadSlotCoordBlock(m) {
  const { mem8 } = m;
  const x = mem8[SLOT_LOOP_INDEX];         // current slot the outer loop is servicing
  mem8[PROJ_Y_LO] = mem8[u16(OBJ_DY_LO + x)];  // copy this column's four coordinate bytes
  mem8[PROJ_Y_HI] = mem8[u16(OBJ_DY_HI + x)];  // out of the parallel arrays into the
  mem8[PROJ_X_LO] = mem8[u16(OBJ_DX_LO + x)];  // fixed working block $61-$64
  mem8[PROJ_X_HI] = mem8[u16(OBJ_DX_HI + x)];
  return;
}
