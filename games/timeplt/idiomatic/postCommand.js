// SPDX-License-Identifier: GPL-3.0-only
/** postCommand — append a command byte and its argument to the 64-cell command ring. A cell is
 * free while its high bit is set; when the one the write cursor names is still occupied the pair
 * is DROPPED silently. Otherwise both bytes go in and the cursor steps two cells on, wrapping
 * inside the ring. It claims nothing about what a command byte selects or when it is acted on.
 * LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { COMMAND_RING } from "./names.js";

const RING_CELLS = 64;
const WRITE_CURSOR = 0xa9b2;

export function postCommand(m, command = m.regs.d, argument = m.regs.e) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  if ((mem8[COMMAND_RING + cursor] & 0x80) === 0) return;
  mem8[COMMAND_RING + cursor] = command;
  const argumentCell = u8(cursor + 1);
  mem8[COMMAND_RING + argumentCell] = argument;
  mem8[WRITE_CURSOR] = (cursor + 2) % RING_CELLS;
}
