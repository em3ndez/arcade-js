// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loadPhaseMotionParamsAndAdvancePhase } from "./loadPhaseMotionParamsAndAdvancePhase.js";
import { clearTargetActorRecord } from "./clearTargetActorRecord.js";
import {
  loc_8f0e,
  loc_8f0f,
  OBJECT_VEL_X,
  OBJECT_VEL_Y,
  loc_8d45,
  loc_8d77,
  LAUNCH_STATE,
  LAUNCH_ARMED_FLAG,
  FLASH_CELL_BASE,
} from "./names.js";

/**
 * advanceTargetActorAlongVelocityElseDespawn — advance a two-axis moving object at IY.
 *
 * When the phase counter hits zero the motion params are reloaded; that reload's final compare
 * leaves a borrow the X subtract below consumes. The X velocity is integrated into (obj+5:obj+6)
 * with the sign chosen by the object's low bit3 (which sign byte) and that byte's bit0 (add vs
 * subtract). The Y velocity is integrated into (obj+3:obj+4); once the Y high byte reaches 0xe8 the
 * object is spent — its scratch cells are cleared and the record is blanked — otherwise the new Y
 * is stored and the phase counter ticks down.
 *
 * LIVE-OUT: none — a void object stepper; the caller reads nothing back.
 */

const SPENT_Y_HIGH = 0xe8; // Y high byte at/above this marks the object spent

export function advanceTargetActorAlongVelocityElseDespawn(m, obj = m.regs.iy) {
  const { mem8, mem16 } = m;

  // reload the phase's motion params on a zero counter; recover the reload's exit borrow
  let borrow = 0;
  if (mem8[loc_8f0e] === 0) {
    const phase = mem8[loc_8f0f];
    loadPhaseMotionParamsAndAdvancePhase(m);
    borrow = ((phase + 1) & 0xff) <= 0x08 ? 1 : 0; // reload's phase++/cp-9 leaves carry set below 9
  }

  // integrate X velocity; low bit3 picks the sign byte, its bit0 selects add vs subtract-with-borrow
  const xv = mem16[OBJECT_VEL_X];
  const sign = mem8[FLASH_CELL_BASE + ((obj & 0x08) ? 1 : 0)];
  const x = mem16[obj + 0x05];
  mem16[obj + 0x05] = u16((sign & 0x01) ? x + xv : x - xv - borrow);

  // integrate Y velocity
  const yv = mem16[OBJECT_VEL_Y];
  const y = u16(mem16[obj + 0x03] + yv);
  if ((y >> 8) >= SPENT_Y_HIGH) {
    mem8[loc_8f0e] = 0; //          object spent: clear its scratch cells
    mem8[loc_8f0f] = 0;
    mem8[LAUNCH_STATE] = 0;
    mem8[loc_8d45] = 0;
    mem8[loc_8d77] = 0;
    mem8[LAUNCH_ARMED_FLAG] = 0;
    return clearTargetActorRecord(m, obj); // tail: blank the record
  }

  mem16[obj + 0x03] = y; // keep moving: store Y, tick the phase counter down
  mem8[loc_8f0e] = u8(mem8[loc_8f0e] - 1);
}
