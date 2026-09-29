// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractState — service the attract state once per vblank. If a credit is present, reset
 * the sub-state and step the game state on to credited; otherwise dispatch the current attract
 * sub-state through the handler table (a tail dispatch: the handler's return propagates).
 *
 * LIVE-OUT: memory-only — the game state, the sub-state, and whatever the dispatched handler writes.
 */

import { CREDITS, GAME_STATE, GAME_SUBSTATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { composeAttractTitleScreen } from "./composeAttractTitleScreen.js";
import { restartAttractDemoAt25m } from "./restartAttractDemoAt25m.js";
import { seedMarioActorRecord } from "./seedMarioActorRecord.js";
import { runAttractDemoFrame } from "./runAttractDemoFrame.js";
import { runDeathAnimationSubstate } from "./runDeathAnimationSubstate.js";
import { clearScreenAndAdvanceSubstate } from "./clearScreenAndAdvanceSubstate.js";
import { loc_07cb } from "./loc_07cb.js";
import { clearSubstateWhenTimerExpires } from "./clearSubstateWhenTimerExpires.js";

const ATTRACT_SUBSTATE = [
  composeAttractTitleScreen, // 0  draw the attract screen
  restartAttractDemoAt25m, // 1  timed advance
  seedMarioActorRecord, // 2  seed the demo sprite record
  runAttractDemoFrame, // 3  the demo-gameplay cascade
  runDeathAnimationSubstate, // 4  the death animation
  clearScreenAndAdvanceSubstate, // 5
  loc_07cb, // 6  countdown animation
  clearSubstateWhenTimerExpires, // 7  timed gate; clears the sub-state
  null, // 8  unused
  null, // 9  unused
];

export function runAttractState(m) {
  const { mem8 } = m;

  if (mem8[CREDITS] !== 0) {
    mem8[GAME_SUBSTATE] = 0x00;
    mem8[GAME_STATE] = (mem8[GAME_STATE] + 1);
    return;
  }

  const substate = mem8[GAME_SUBSTATE];
  const handler = ATTRACT_SUBSTATE[substate];
  if (handler == null) {
    throw new NotImplemented(`attract sub-state ${substate} has no handler`);
  }
  // Tail dispatch: propagate the handler's skip signal unchanged.
  return handler(m);
}
