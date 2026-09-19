// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardCollision — vector a collision test to the current board's handler, reading
 * BOARD and going through a six-entry jump table (1=25m, 2=50m, 3=75m, 4=100m; 0 and 5 are
 * null guards). The staged position in HL is pushed FIRST so it sits below the dispatch frame
 * and survives to the handler, which recovers it with a pop.
 *
 * LIVE-OUT: memory, the stack pointer, and the handler's two result registers.
 */

import { u16 } from "../../../core/int.js";
import {
  BOARD,
  BOARD_COLLISION_TABLE,
} from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

const DISPATCH_TABLE_2874 = "0x2874 (0x6227 collision dispatch)";

export function dispatchBoardCollision(m, hl = m.regs.hl) {
  const { mem8 } = m;

  const board = mem8[BOARD];

  // Pushed FIRST, below the dispatch frame, so the handler's opening pop recovers it.
  m.push16(hl);

  // 8-bit offset double: board 128 wraps back to 0.
  const entry = u16(BOARD_COLLISION_TABLE + ((board * 2) & 0xff));
  const target = mem8[entry] | (mem8[u16(entry + 1)] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_2874);
}
