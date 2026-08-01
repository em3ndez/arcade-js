// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextBoard — step the board-order pointer to the next board and enter the
 * "HOW HIGH CAN YOU GET?" interlude.  ROM 0x178E.
 *
 * The final sub-step of the board-cleared / board-advance sequence. It is dispatched
 * from loc_1615 (GAME_SUBSTATE == 0x16, "board-advance") as the last entry of that
 * dispatcher's rst-0x28 table, selected once its 0x6388 sub-step counter reaches this
 * step. It first ticks the shared rst-0x18 sub-state gate: while that timer is still
 * counting down the routine does nothing (the caller is skipped); only on the frame the
 * timer EXPIRES does the advance commit.
 *
 * On commit it walks BOARD_SEQ_PTR forward one entry in the ROM board-order table and
 * reads the next board index. The table ends in a 0x7F terminator; hitting it reloads
 * the pointer to 0x3A73 — the start of the level-5+ group — so the board order repeats
 * forever (this is the level loop's wrap). The new index is published to BOARD. It then
 * posts deferred task [opcode 0x05, argument 0x00], clears the 0x6388 board-advance
 * sub-step counter, and arms the next sub-state: a 0x30-frame SUBSTATE_TIMER wait into
 * GAME_SUBSTATE 8 (the how-high interlude for the new board).
 *
 * Callees, direct (bottom-up): tickSubstateTimer (the rst-0x18 gate; boolean = expired)
 * and enqueueTask (the task-ring post primitive; reads D = opcode, E = argument).
 *
 * Memory-equivalent to the frozen oracle — equivalence-178e.test.js.
 * GATE:     crafted-entry — poke-forced board-advance dispatches (attract never reaches
 *           sub-state 0x16) + crafted skip / walk / 0x7F-terminator-wrap arms; teeth =
 *           pointer advanced by 2 instead of 1.
 * LIVE-OUT: memory-only — BOARD_SEQ_PTR (16-bit), BOARD, the task ring (TASK_TAIL + two
 *           slots), 0x6388, SUBSTATE_TIMER, GAME_SUBSTATE. Registers/flags (A/HL/DE/F)
 *           are dead ABI: the rst-0x28 dispatch chain that returns here reads none.
 *           SP/pc are the dropped stack model (the oracle's push/ret becomes the JS
 *           return), so its residue lands only in STACK_SCRATCH, excluded by the contract.
 * NAMES:    BOARD_SEQ_PTR (0x622A), BOARD (0x6227), SUBSTATE_TIMER (0x6009),
 *           GAME_SUBSTATE (0x600A) from ram.js. 0x6388 kept hex — the board-advance
 *           sub-step counter loc_1615 indexes; no confirmed ram.js name. 0x3A73 = ROM
 *           table wrap target; 0x7F = end-of-table sentinel; 0x0500 = the posted task.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { enqueueTask } from "./enqueueTask.js";
import { BOARD_SEQ_PTR, BOARD, SUBSTATE_TIMER, GAME_SUBSTATE } from "./ram.js";

const BOARD_ADVANCE_SUBSTEP = 0x6388; // loc_1615's board-advance sub-step index (no ram.js name)
const SEQ_TABLE_WRAP = 0x3a73; // ROM board-order table: restart of the level-5+ group
const SEQ_TERMINATOR = 0x7f; // end-of-table sentinel

export function advanceToNextBoard(m) {
  const { regs, mem } = m;

  // rst 0x18 gate: tick the sub-state timer; run the advance only the frame it expires.
  if (!tickSubstateTimer(m)) return;

  // Walk the board-order pointer to the next entry and read that board's index; on the
  // 0x7F terminator reload the pointer to 0x3A73 so the board order loops forever.
  let ptr = (mem.read16(BOARD_SEQ_PTR) + 1) & 0xffff;
  let board = mem.read8(ptr);
  if (board === SEQ_TERMINATOR) {
    ptr = SEQ_TABLE_WRAP;
    board = mem.read8(ptr);
  }
  mem.write16(BOARD_SEQ_PTR, ptr);
  mem.write8(BOARD, board);

  // Post the deferred task [opcode 0x05, argument 0x00] (DE = 0x0500).
  regs.d = 0x05;
  regs.e = 0x00;
  enqueueTask(m);

  // Reset the board-advance sub-step counter, then arm the next sub-state: wait 0x30
  // frames (SUBSTATE_TIMER) into GAME_SUBSTATE 8, the how-high interlude for the new board.
  mem.write8(BOARD_ADVANCE_SUBSTEP, 0x00);
  mem.write8(SUBSTATE_TIMER, 0x30);
  mem.write8(GAME_SUBSTATE, 0x08);
}
