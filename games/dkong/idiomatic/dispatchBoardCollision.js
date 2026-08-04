// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardCollision — vector a collision test to the current board's handler.
 *
 * Called from the collision cascade with a position already staged in the pointer register:
 * it reads BOARD and vectors through a six-entry jump table to the collision handler for
 * that board type — 1 = 25m girders, 2 = 50m, 3 = 75m, 4 = 100m rivets. Entries 0 and 5 are
 * null guard slots, and BOARD is never range-checked, so a stray value vectors off the table;
 * the shared computed-dispatch helper surfaces that as a loud unimplemented-target throw
 * rather than a silent reset. Each handler sweeps the board's object records for one
 * overlapping the caller's position and leaves the hit/miss result its callers read back —
 * the accumulator, and for the hammer caller the index register too. This routine only
 * routes; the handler does the work.
 *
 * The passed-in position is genuine data, not call plumbing: this routine PUSHES it and every
 * handler recovers it with a pop as its first act. It has to be pushed FIRST, underneath the
 * dispatch's own frame, to survive to the handler. Drop the push and every handler pops the
 * wrong stack word and the return unwinds two bytes off.
 *
 * The table index is an 8-BIT double of the board number, so a board number of 128 or more
 * wraps the offset back into the start of the table rather than reading past its end. The
 * dispatch is genuine computed control flow into a table of target addresses, so it goes
 * through the shared computed-dispatch helper rather than a local table of JS functions.
 * Nothing about the register or flag state at the moment of dispatch is reproduced: every
 * handler opens by popping the position and overwrites the rest before reading it.
 *
 * LIVE-OUT: memory, the stack pointer, and the handler's two result registers, both consumed
 * by the callers. This routine itself returns nothing.
 */

import { BOARD } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The jump table: six little-endian handler addresses, indexed by BOARD.
const BOARD_COLLISION_TABLE = 0x2874;

// The dispatch-site label. It only ever surfaces inside the unimplemented-target throw,
// naming which table a stray BOARD fell off of.
const DISPATCH_TABLE_2874 = "0x2874 (0x6227 collision dispatch)";

export function dispatchBoardCollision(m) {
  const { regs, mem } = m;

  // The current board number selects its collision handler.
  const board = mem.read8(BOARD);

  // The caller's position: genuine data every handler recovers with a pop. Pushed FIRST so
  // it sits below the dispatch's own frame and survives to the handler.
  m.push16(regs.hl);

  // Doubling the board into a 2-byte table offset is an 8-BIT operation — board 128 wraps
  // the offset to 0 — so the address math is `base + (2*board & 0xff)`, NOT `base + 2*board`.
  // Then read the little-endian handler address out of the table.
  const entry = (BOARD_COLLISION_TABLE + ((board * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Dispatch to the board's collision handler. Its hit/miss result is left in the result
  // registers on the machine; nothing consumes a return value at this level.
  loc_00ca(m, target, DISPATCH_TABLE_2874);
}
