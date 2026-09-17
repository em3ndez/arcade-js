// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateAndArmTimer — bump GAME_SUBSTATE by one (8-bit wrap) and re-arm SUBSTATE_TIMER
 * so the new sub-state holds 64 frames before it may proceed.
 *
 * LIVE-OUT: memory-only — GAME_SUBSTATE incremented, SUBSTATE_TIMER re-armed.
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER } from "./names.js";

const SUBSTATE_WAIT_FRAMES = 0x40;

export function advanceSubstateAndArmTimer(m) {
  const { mem8 } = m;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1) & 0xff;
  mem8[SUBSTATE_TIMER] = SUBSTATE_WAIT_FRAMES;
}
