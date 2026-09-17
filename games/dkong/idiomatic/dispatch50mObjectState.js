// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatch50mObjectState — 50m board-object state machine: gated to the 50m board, pick one of two
 * 8-byte object records by frame parity, then dispatch on the record's state byte (0..3) to that
 * state's arm. State 0 parks at the top, 1 slides down, 2 dwells at the bottom, 3 raises back up.
 * The parked arm takes its record base off the stack; the other three take it as an argument.
 *
 * LIVE-OUT: memory-only, all written by the dispatched arm.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BOARD_OBJ_SCRATCH, FRAME } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { hold50mObjectParked } from "./hold50mObjectParked.js";
import { slide50mObjectDown } from "./slide50mObjectDown.js";
import { advance50mObjectStateOnRandomGate } from "./advance50mObjectStateOnRandomGate.js";
import { raise50mObjectAndPark } from "./raise50mObjectAndPark.js";

const BOARD_MASK = 0x02;

export function dispatch50mObjectState(m) {
  const { regs, mem8 } = m;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  const recordBase =
    (mem8[FRAME] & 1) === 1 ? BOARD_OBJ_SCRATCH : BOARD_OBJ_SCRATCH + 8;

  const state = mem8[recordBase];
  switch (state) {
    case 0:
      // Parked arm takes its record base off the stack.
      m.push16(recordBase);
      return hold50mObjectParked(m);
    case 1:
      return slide50mObjectDown(m, recordBase);
    case 2:
      return advance50mObjectStateOnRandomGate(m, recordBase);
    case 3:
      return raise50mObjectAndPark(m, recordBase);
    default:
      throw new NotImplemented(
        `dispatch50mObjectState: object-state dispatch on unexpected state ${state}`,
      );
  }
}
