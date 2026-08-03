// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13a1 — timer-gated 0x0702 sub-state handler (table idx 0x17).  ROM 0x13A1.
 *
 * A handler in the in-game GAME_SUBSTATE dispatch table at ROM 0x0702 (reached via
 * `ld a,(0x600a) / rst 0x28`, loc_06fe). It is the TWIN of loc_138f — same shape,
 * only the source byte differs (this one reads P1's saved context, loc_138f reads
 * P2's) — and was wired in late by the 0x0702 table audit that found idx 0x17
 * un-routed. Its tail (0x1395) is the loc_138f tail duplicated in place.
 *
 * What it does, mechanically:
 *   - `rst 0x18` (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009) down one. While
 *     the timer has NOT expired the rest of the handler is SKIPPED — the classic
 *     "wait N frames, then act" gate. Polarity matters: the body runs only on the
 *     frame the counter reaches 0.
 *   - On expiry it RE-ARMS the timer to 1 (the oracle's `inc (hl)`, with HL still
 *     pointing at 0x6009 from rst 0x18), so the handler re-fires every following
 *     frame while GAME_SUBSTATE stays 0x17.
 *   - It then reads P1_CONTEXT's first byte (0x6040, P1's saved LIVES field) and
 *     writes the next GAME_SUBSTATE (0x600A): 0x17 when that byte is non-zero, else
 *     0x14. (Writing 0x17 keeps the handler dispatching itself; 0x14 hands off.)
 *
 * NAME: kept neutral (loc_13a1) on purpose. The mechanics above are certain, but the
 * game-level MEANING of sub-states 0x17 / 0x14 is not independently confirmed and this
 * slot is never dispatched in attract or ordinary play — an English name here would
 * assert semantics not yet earned (the routine-level sprite-record trap). Its twin
 * loc_138f is likewise un-promoted.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13a1.test.js.
 * GATE:     exhaustive — memory-observable behaviour is a total function of two bytes
 *           (SUBSTATE_TIMER 0x6009, P1_CONTEXT 0x6040); swept over all 65,536 combos vs
 *           the oracle on RAM − STACK_SCRATCH, plus crafted entries poked onto real
 *           in-game states. Unreachable in attract/driven runs (0 dispatches over
 *           1500 attract + 3000 coin-start frames): a defensively-wired idx-0x17 slot.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009) and GAME_SUBSTATE (0x600A). The
 *           oracle's SP/PC churn is the rst-0x18 caller-skip mechanism this boolean
 *           early-return replaces (not part of the contract); the dispatcher ignores
 *           the handler's residual A/C/F/HL.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), P1_CONTEXT (0x6040) — ram.js.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, P1_CONTEXT } from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018

export function loc_13a1(m) {
  const { mem } = m;

  // rst 0x18: tick SUBSTATE_TIMER; skip the rest until it expires this frame.
  if (!tickSubstateTimer(m)) return;

  // `inc (hl)` (HL == SUBSTATE_TIMER): re-arm the just-expired timer back to 1 so the
  // handler re-fires next frame. 8-bit wrap kept faithful to the Z80 `inc`.
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);

  // Select the next sub-state from P1's saved context byte: non-zero -> 0x17, zero -> 0x14.
  const p1 = mem.read8(P1_CONTEXT);
  mem.write8(GAME_SUBSTATE, p1 !== 0 ? 0x17 : 0x14);
}
