// SPDX-License-Identifier: GPL-3.0-only
// Object-AI planner arm-window handler: tick the arm counter (record+3); once both it and the position
// (record+4) sit inside the [96,160) window, advance the planner sub-state by two, seed the move timers,
// and set the direction from the reference-X compare. Until the window is reached (either field outside
// it) it hands off to the shared cross-player move tail.
import { beginObjectCrossPlayerMove } from "./beginObjectCrossPlayerMove.js";
import { loc_4202 } from "./names.js";
import { u8 } from "../../../core/int.js";

const WINDOW_LO = 96, WINDOW_SPAN = 64; // in-window when u8(field-96) < 64, i.e. field in [96,160)

const inWindow = (v) => u8(v - WINDOW_LO) < WINDOW_SPAN;

export function armDirectedMoveWhenInWindow(m, record = m.regs.ix) {
  const { mem8 } = m;

  mem8[record + 0x03] = u8(mem8[record + 0x03] + 1);

  if (!inWindow(mem8[record + 0x03]) || !inWindow(mem8[record + 0x04])) {
    return beginObjectCrossPlayerMove(m, record);
  }

  mem8[record + 0x02] = u8(mem8[record + 0x02] + 2);
  mem8[record + 0x10] = 3;
  mem8[record + 0x11] = 12;
  mem8[record + 0x05] = 0;
  mem8[record + 0x13] = 0;

  const referenceBelow = mem8[loc_4202] < mem8[record + 0x04];
  mem8[record + 0x06] = referenceBelow ? 1 : 0;
}
