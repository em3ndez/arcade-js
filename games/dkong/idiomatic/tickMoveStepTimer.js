// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickMoveStepTimer — decrement the player's walk/climb sub-step timer.  ROM 0x1D8A.
 *
 * The SHARED decrement TAIL of the player walk/climb animation steppers. Both the
 * walk stepper (entry_1d03, via loc_1d76's timer-running branch) and its climb twin
 * (loc_1cf2) route here to do one thing: knock MARIO_MOVE_STEP_TIMER (0x620F) down by
 * one and return. That timer is the sub-step pacer — while it is non-zero the mover
 * holds its current animation sub-step; the frame it reaches 0 the stepper (next
 * frame, by RE-READING 0x620F) reloads it (to 4 for walk, 3 for climb) and advances
 * to the next sub-step. This routine performs only the countdown; it neither reloads
 * nor branches on the result — the expiry decision is made by a later re-read of
 * 0x620F, not by anything this routine leaves in a register or flag.
 *
 *   1d8a  ld hl,0x620f
 *   1d8d  dec (hl)         ; RMW the BYTE at 0x620F (not the HL pointer)
 *   1d8e  ret
 *
 * A LEAF: reads and writes only MARIO_MOVE_STEP_TIMER, calls nothing. The oracle's
 * `ret` is a plain return to the walk/climb stepper's caller (loc_197a's per-frame
 * cascade) — no caller-skip idiom — so this routine returns void; the JS return is
 * the control flow.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d8a.test.js.
 * GATE:     exhaustive — a total function of the 0x620F byte; compared to the oracle
 *           on RAM over all 256 values (the complete input space), plus real captured
 *           attract dispatches. Reached only as the walk/climb stepper tail, in-NMI.
 * LIVE-OUT: memory-only — mem[0x620F] := (timer - 1) & 0xff. The oracle's `ret`
 *           (SP += 2, PC := return addr) is the normal return the JS return replaces,
 *           so SP/PC are not in the contract; its residual HL (= 0x620F), A and F are
 *           dead ABI — the exit successor loc_197a @ 0x1983 immediately does
 *           `call 0x1f72`, which reads none of them before overwriting.
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F) — from ram.js (the ground walk/climb
 *           sub-step timer; control-poke confirmed there).
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function tickMoveStepTimer(m) {
  const { mem } = m;
  // dec (hl) at 0x620F — decrement the walk/climb sub-step timer in place.
  mem.write8(MARIO_MOVE_STEP_TIMER, (mem.read8(MARIO_MOVE_STEP_TIMER) - 1) & 0xff);
}
