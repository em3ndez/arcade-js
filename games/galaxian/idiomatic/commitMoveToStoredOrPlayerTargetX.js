// SPDX-License-Identifier: GPL-3.0-only
// Alternate horizontal target select: when bit0 of the object-table mode flag is set, steer the actor
// toward the object-table's stored target X; otherwise run the ordinary cross-reference target pick.
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";
import { commitMoveToTargetX } from "./commitMoveToTargetX.js";
import { OBJ_TABLE } from "./names.js";

const STORED_TARGET_X = OBJ_TABLE + 0x19; // the mode flag's record holds its target X at this field

export function commitMoveToStoredOrPlayerTargetX(m, record = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[OBJ_TABLE] & 0x01) {
    return commitMoveToTargetX(m, mem8[STORED_TARGET_X], record);
  }
  return commitMoveAcrossPlayerX(m, record);
}
