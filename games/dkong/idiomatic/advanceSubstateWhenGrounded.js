// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateWhenGrounded — hold this sub-state until Mario has landed, then
 * advance to the next sub-state and abort the rest of the frame.  ROM 0x1a2a.
 *
 * The idx3 (WAIT+EXIT) handler of the bonus-expired sub-state machine: entry_1a07
 * reads BONUS_EXPIRED_STEP (0x6386) and, once that sequence has run its INIT (idx1)
 * and DELAY (idx2) steps and reached idx3, dispatches here every frame. This step
 * gates the final advance on Mario being on solid ground:
 *
 *   - MARIO_AIRBORNE (0x6216) != 0  — Mario is still jumping/falling: do nothing and
 *     return true, so entry_1a07 returns true and the per-frame update cascade
 *     (loc_197a) runs to completion normally. The step keeps waiting next frame.
 *   - MARIO_AIRBORNE == 0 — Mario has landed: run the shared tail
 *     advanceSubstateAndArmTimer (GAME_SUBSTATE 0x600A += 1, SUBSTATE_TIMER 0x6009 =
 *     0x40), stepping the in-game sub-state dispatch index to the next handler and
 *     re-arming its 64-frame wait; then return false.
 *
 * The `false` return is the caller-skip signal. In the oracle the grounded arm is
 * `pop hl / jp 0x19d2`: the pop discards loc_197a's saved return address, so when
 * the shared tail (at 0x19d2) hits its own `ret` it unwinds past loc_197a straight
 * to loc_197a's caller — the rest of the per-frame cascade after 0x19bf is skipped
 * for this frame. Modelling that as a boolean, `!advanceSubstateWhenGrounded(m)`
 * propagates up through entry_1a07 to loc_197a's `if (!m.call(...)) return;`.
 *
 * A near-leaf: it reads one byte (MARIO_AIRBORNE) and, on the grounded arm, defers
 * all memory writes to advanceSubstateAndArmTimer. It loads its own state; the
 * caller's registers are not a live-in.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a2a.test.js.
 * GATE:     exhaustive — the whole memory+control behaviour is a total function of
 *           two bytes: MARIO_AIRBORNE selects the branch, GAME_SUBSTATE is the byte
 *           the grounded tail increments. Compared to the oracle over all 65,536
 *           (airborne × substate) combos on RAM (minus STACK_SCRATCH) + the boolean
 *           return, plus real captured cascade states (hooked at parent 0x1a07)
 *           poked to force each branch. Attract never reaches 0x1a2a directly
 *           (BONUS_EXPIRED_STEP never hits idx3), so the real states are crafted
 *           from the parent router's captures.
 * LIVE-OUT: memory-only — GAME_SUBSTATE (incremented) and SUBSTATE_TIMER (= 0x40) on
 *           the grounded branch — PLUS the boolean caller-skip return, the control
 *           signal entry_1a07/loc_197a consume. The oracle's residual A/HL/F are dead
 *           ABI (no successor reads them); SP/pc are the dropped Z80 stack model, so
 *           the oracle's push/pop residue lands only in STACK_SCRATCH, excluded.
 * NAMES:    MARIO_AIRBORNE (0x6216) — from ram.js. GAME_SUBSTATE (0x600A) and
 *           SUBSTATE_TIMER (0x6009) are written by the callee advanceSubstateAndArmTimer.
 */

import { MARIO_AIRBORNE } from "./ram.js";
import { advanceSubstateAndArmTimer } from "./advanceSubstateAndArmTimer.js";

export function advanceSubstateWhenGrounded(m) {
  const { mem } = m;

  // ld a,(0x6216) / and a / ret nz — while Mario is airborne, keep waiting: the
  // cascade continues normally this frame (caller sees "continue").
  if (mem.read8(MARIO_AIRBORNE) !== 0) return true;

  // Grounded: advance the in-game sub-state and re-arm its timer via the shared
  // tail, then caller-skip (abort the rest of loc_197a for this frame).
  advanceSubstateAndArmTimer(m);
  return false;
}
