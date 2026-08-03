// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_138f — timed in-game sub-state transition, branched on player 2's saved context.  ROM 0x138f.
 *
 * One of the 29 in-game sub-state handlers dispatched from dispatchInGameSubstate
 * (the 0x0702 table) while a credited game runs. It is a one-shot timed gate: each
 * frame the `rst 0x18` helper (tickSubstateTimer) decrements SUBSTATE_TIMER (0x6009),
 * and ONLY on the frame that counter reaches zero does the rest of the routine run.
 * On that expiry frame it re-arms the timer to 1 and writes the next sub-state index
 * into GAME_SUBSTATE (0x600A): 0x17 when player 2's saved context byte (0x6048, the
 * first byte of P2_CONTEXT = P2's saved lives) is non-zero, otherwise 0x14.
 *
 * Its twin loc_13a1 is byte-identical except it reads player 1's context (0x6040); the
 * oracle shares this same tail (loc_1395) between the two. The routine's whole conditional
 * is the timer gate plus that one non-zero test; nothing else branches.
 *
 * NAME: kept the neutral loc_ — the memory mechanics are fully understood, but the
 * game-level meaning of sub-states 0x14 and 0x17 (undocumented indices past the
 * gameplay/death/advance ones) and why player 2's context selects between them are not
 * confirmed to the routine-name evidence bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-138f.test.js.
 * GATE:     crafted-entry — attract (6000+ frames) never dispatches this sub-state, so it
 *           is validated by running the oracle vs this routine on crafted entries built
 *           from a real booted attract machine + surgical pokes: an EXHAUSTIVE sweep of
 *           SUBSTATE_TIMER 0..255 (pinning that only value 1 expires — all others just
 *           decrement) at both a live and a dead P2 context, plus an EXHAUSTIVE sweep of
 *           P2_CONTEXT 0..255 at the expiry value (pinning the non-zero -> 0x17 / zero ->
 *           0x14 branch). SP is set inside STACK_SCRATCH so the oracle's push/pop lands in
 *           dead memory. Two teeth: invert-the-branch and drop-the-re-arm.
 * LIVE-OUT: memory-only — writes SUBSTATE_TIMER (0x6009) and, on expiry, GAME_SUBSTATE
 *           (0x600A). The dispatcher discards this handler's return and issues no register
 *           read after it, so the oracle's residual A/C/HL/flags are dead ABI; SP/pc are
 *           the Z80 caller-skip idiom the boolean gate replaces and are not modelled.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), P2_CONTEXT (0x6048) from
 *           ram.js. Sub-state codes 0x14/0x17 kept hex — unconfirmed ROM sub-state indices.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { SUBSTATE_TIMER, GAME_SUBSTATE, P2_CONTEXT } from "./ram.js";

// The two follow-on sub-state indices this handler selects between. Kept hex: their
// game-level meaning (past the documented gameplay/death/advance states) is unconfirmed.
const SUBSTATE_P2_LIVE = 0x17; // P2 still has a saved game
const SUBSTATE_P2_DEAD = 0x14; // P2 has none

export function loc_138f(m) {
  const { mem } = m;

  // rst 0x18 — tick the sub-state countdown. The gate's "still counting" path is the
  // oracle's push16 + inc-sp caller-skip, here just a false return: nothing to do yet.
  if (!tickSubstateTimer(m)) return;

  // inc (hl) — HL is SUBSTATE_TIMER (0x6009), left there by the gate. The timer just hit
  // 0, so this re-arms it to 1 (one frame of grace before the next sub-state runs).
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);

  // and a / jp nz — pick the follow-on sub-state from player 2's saved context.
  const nextSubstate = mem.read8(P2_CONTEXT) !== 0 ? SUBSTATE_P2_LIVE : SUBSTATE_P2_DEAD;
  mem.write8(GAME_SUBSTATE, nextSubstate);
}
