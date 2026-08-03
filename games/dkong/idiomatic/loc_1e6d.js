// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e6d — stamp Mario's sprite facing on the board-won path, then commit the
 * board-advance and unwind out of the movement cascade.  ROM 0x1E6D.
 *
 * A shared interior of Mario's per-frame position check (sub_1e57), reached on the
 * girder-board win condition (Mario has climbed to the rescue row near Pauline). The
 * caller hands it a single selector — the carry flag — and it sets Mario's sprite-record
 * code byte (MARIO_SPRITE_RECORD + SPRITE_CODE) to a bare facing value:
 *   • carry SET   -> 0x00  (horizontal-flip bit clear)
 *   • carry CLEAR -> 0x80  (horizontal-flip / facing bit set)
 * so the whole tile-code byte becomes just that flip bit — the "sprite mirror flag".
 *
 * It then commits the win: enterBoardAdvanceAndUnwind (ROM 0x1E85) stamps GAME_SUBSTATE
 * := 0x16 (the board-cleared / advance sub-state) and UNWINDS out of the movement cascade,
 * aborting any further movement on the frame the board is won. This routine returns that
 * callee's boolean unwind signal unchanged — false, the caller-skip meaning "abort: do
 * not continue".
 *
 * The carry is a genuine live-in set by the STILL-TRANSLATED caller (sub_1e57 / loc_1e7a),
 * so it is read from the machine flag at this oracle boundary rather than taken as a
 * parameter; it promotes to a boolean argument once those callers are idiomatic.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e6d.test.js.
 * GATE:     crafted-entry — a long attract run dispatches 0x1E6D ZERO times (attract never
 *           completes a board / rescues Pauline), so the gate is crafted from real booted
 *           attract RAM with a controlled return stack and a sprite/sub-state sentinel,
 *           driving BOTH carry arms, then oracle-vs-idiomatic on fresh clones. The oracle's
 *           tail-call into 0x1E85's two-level unwind (discard own return, then ret to the
 *           grandparent) is modeled on the candidate as one discarded pop + one net return
 *           so pc + SP line up. Teeth: an inverted-flip twin, a dropped-sprite-write twin, a
 *           dropped-board-advance twin, and a no-unwind twin, each caught.
 * LIVE-OUT: MARIO_SPRITE_RECORD + SPRITE_CODE (the flip byte) and GAME_SUBSTATE (:= 0x16,
 *           written by the callee) in memory, plus the boolean unwind signal (false). No
 *           live registers/flags out — the oracle's residual A/flags and the discarded
 *           return are dead ABI.
 * NAMES:    MARIO_SPRITE_RECORD (0x694C) + SPRITE_CODE (0x01) -> 0x694D from ram.js;
 *           enterBoardAdvanceAndUnwind (ROM 0x1E85) direct-called (writes GAME_SUBSTATE).
 *           0x80 is the sprite code's horizontal-flip / facing bit.
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE } from "./ram.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js"; // ROM 0x1E85

export function loc_1e6d(m) {
  const { regs, mem } = m;

  // Set Mario's sprite-record code byte to just the facing bit the caller selected:
  // carry set -> flip clear (0x00), carry clear -> flip set (0x80).
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, regs.fC ? 0x00 : 0x80);

  // The board is won -> enter the board-advance sub-state and unwind out of the movement
  // cascade. Propagate the callee's unwind signal (false = abort, do not continue).
  return enterBoardAdvanceAndUnwind(m);
}
