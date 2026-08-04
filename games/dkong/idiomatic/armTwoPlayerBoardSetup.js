// SPDX-License-Identifier: GPL-3.0-only
/**
 * armTwoPlayerBoardSetup — the 2-player arm of the board-setup sub-state step: clear two board
 * control latches, post two draw tasks, advance the game sub-state, then paint the shared 3-cell
 * column.
 *
 * Board setup runs as a short sub-state sequence before play begins, and this is that step's
 * TWO-PLAYER variant: the one-player path advances straight through, and routes here only when the
 * game is a two-player one, so this arm is what lays down the extra two-player start furniture. A
 * driven two-coin, start-2 run confirms the context — it dispatches exactly once, at game start.
 *
 * What it does, straight-line, with no data-dependent branch of its own:
 *   - clears the two board control latches,
 *   - posts two deferred draw tasks onto the task ring — [opcode 3, argument 2] then [opcode 2,
 *     argument 1],
 *   - advances the game sub-state from 2 to 5, then
 *   - FALLS THROUGH into the shared 3-cell column painter, which writes three tilemap cells one
 *     row apart. That painter's own return is what returns from here, so the value handed back is
 *     the painter's.
 *
 * It reads no memory of its own; all the data-dependent behaviour is inside the task post, which
 * has its own ring-full and ring-wrap arms.
 *
 * LIVE-OUT: memory — the two latches, the two posted ring slots and the ring tail, the advanced
 * sub-state, and the three painted tilemap cells.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
// The column painter is imported in its faithful-translation form ON PURPOSE, and it is the one
// import here that must not be swapped for the idiomatic twin: this routine's tail is a FALL-
// THROUGH, so the painter's own return is what returns from this routine, whereas the twin models
// that return as a plain JS return and leaves the guest program counter and stack pointer where
// they started. Removing the difference means moving the tail return into this routine — a change
// of signature, not a change of import.
import { loc_09ee } from "../translated/loc_09ee.js";

// The two board control latches this arm clears. They are board control outputs rather than work
// RAM, so they carry no shared name.
const BOARD_CONTROL_LATCH_A = 0x7d86;
const BOARD_CONTROL_LATCH_B = 0x7d87;

export function armTwoPlayerBoardSetup(m) {
  const { regs, mem } = m;

  // Clear the two board control latches.
  mem.write8(BOARD_CONTROL_LATCH_A, 0x00);
  mem.write8(BOARD_CONTROL_LATCH_B, 0x00);

  // Post two draw tasks [opcode, argument] onto the task ring. The post takes the pair in a
  // register, so each is staged there before its call.
  regs.de = 0x0302; // [opcode 3, argument 2]
  enqueueTask(m);
  regs.de = 0x0201; // [opcode 2, argument 1]
  enqueueTask(m);

  // Advance the board-setup sub-state 2 -> 5.
  mem.write8(GAME_SUBSTATE, 0x05);

  // Fall through into the shared 3-cell column painter; its `ret` returns from here.
  return loc_09ee(m);
}
