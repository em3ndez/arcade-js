// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateAndArmTimer — step to the next in-state sub-state and hold it for 64
 * frames.
 *
 * The shared closing act of an in-state update: it bumps GAME_SUBSTATE by one — advancing
 * the sub-state dispatch index to the next handler within the current game state — and
 * re-arms SUBSTATE_TIMER, so the new sub-state waits 64 frames before it may proceed (the
 * per-frame sub-state tick counts that byte down one per frame). This is the "advance to
 * the next sub-state, after a delay" form of the "wait N frames then go to sub-state M"
 * idiom, with M = current + 1.
 *
 * A LEAF: its only input is GAME_SUBSTATE's current byte (the +1 wraps at 8 bits);
 * SUBSTATE_TIMER is set unconditionally. Writes memory, calls nothing.
 *
 * LIVE-OUT: memory-only — GAME_SUBSTATE incremented, SUBSTATE_TIMER re-armed.
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER } from "./names.js";

const SUBSTATE_WAIT_FRAMES = 0x40; // frames the new sub-state holds before it proceeds

export function advanceSubstateAndArmTimer(m) {
  const { mem } = m;
  // Advance the sub-state dispatch index to the next handler (8-bit wrap).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
  // Re-arm the countdown so the new sub-state waits before it may proceed.
  mem.write8(SUBSTATE_TIMER, SUBSTATE_WAIT_FRAMES);
}
