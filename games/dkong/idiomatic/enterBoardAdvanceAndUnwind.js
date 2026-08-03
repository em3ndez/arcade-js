// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterBoardAdvanceAndUnwind — commit "this board is complete": set the board-advance
 * sub-state, then unwind out of the movement cascade.  ROM 0x1E85.
 *
 * The shared completion tail of Mario's per-frame position check (sub_1e57). That check
 * reaches here from either board-clear condition:
 *   - a rivet board with RIVETS_LEFT == 0 (loc_1e80), or
 *   - a girder board where Mario has climbed to the rescue row near Pauline (loc_1e6d).
 * Both mean the board is won, so this writes GAME_SUBSTATE := 0x16 — the
 * "board-cleared / advance" sub-state that dispatchBoardClearedInterlude's dispatcher then runs to play the
 * board-advance interlude and step to the next board.
 *
 * It then UNWINDS: the oracle discards its own return address and returns one extra level
 * up, straight out of the movement cascade (sub_1e57's caller loc_197a), so no further
 * movement is processed on the frame the board is won. In direct-call form that non-local
 * exit is a boolean — it returns false, the caller-skip signal meaning "abort: do not
 * continue."
 *
 * A LEAF: writes one byte, reads nothing (its only "input" is the return stack it unwinds,
 * which is dead scratch), calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e85.test.js.
 * GATE:     crafted-entry — a long attract run dispatches 0x1E85 ZERO times (attract never
 *           completes a board / rescues), so the gate is crafted from real booted attract
 *           RAM with a controlled return stack, then oracle-vs-idiomatic on fresh clones.
 *           The oracle's two-level unwind (discard own return, then ret to the grandparent)
 *           is modeled on the candidate as one discarded pop + one net return so pc + SP
 *           line up. Straight-line, so there are no unreached arms. Teeth: a dropped-write
 *           twin, a wrong-substate twin, a stray-stack-pop twin, and a no-unwind (returns
 *           true) twin, each caught.
 * LIVE-OUT: GAME_SUBSTATE (:= 0x16) in memory, plus the boolean unwind signal (false). No
 *           live registers/flags — every consumer reads only the sub-state byte and the
 *           unwind; the oracle's residual A (= 0x16) and the discarded return in HL are
 *           dead ABI.
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js. 0x16 is the board-cleared/advance sub-state
 *           code that dispatchBoardClearedInterlude / advanceToNextBoard run.
 */

import { GAME_SUBSTATE } from "./ram.js";

export function enterBoardAdvanceAndUnwind(m) {
  // The board is won — enter the board-cleared/advance sub-state (0x16), which dispatchBoardClearedInterlude
  // runs to play the interlude and step to the next board.
  m.mem.write8(GAME_SUBSTATE, 0x16);

  // Unwind out of the movement cascade: abort the caller (and its caller), so no further
  // movement runs on the frame the board is won.
  return false;
}
