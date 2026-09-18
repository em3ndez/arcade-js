// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroRoarStep — the final step of the opening Kong-climb cutscene, called once a frame while
 * current. Keyed off the phase countdown: at 144 frames left Kong roars (priority roar tune held
 * 3 frames, a cutscene sprite byte bumped up), at 24 frames left that byte is bumped back down.
 * When the countdown expires the cutscene ends: the step sequence wraps and the sub-state advances
 * to the how-high screen.
 *
 * LIVE-OUT: memory-only.
 */

import {
  SUBSTATE_TIMER,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  INTRO_STEP,
  GAME_SUBSTATE,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

const CUTSCENE_SPRITE_BYTE = 0x6919; // no shared name; kept as its own address

const ROAR_MARK = 0x90; // countdown value at which the roar fires
const LOWER_MARK = 0x18; // countdown value at which the sprite bump reverses
const ROAR_TUNE = 0x0f;
const PRIORITY_PULSE = 0x03;

export function runIntroRoarStep(m) {
  const { mem8 } = m;
  const countdown = mem8[SUBSTATE_TIMER];

  if (countdown === ROAR_MARK) {
    mem8[SND_PRIORITY] = ROAR_TUNE;
    mem8[SND_PRIORITY_FRAMES] = PRIORITY_PULSE;
    mem8[CUTSCENE_SPRITE_BYTE] = (mem8[CUTSCENE_SPRITE_BYTE] + 1);
  } else if (countdown === LOWER_MARK) {
    mem8[CUTSCENE_SPRITE_BYTE] = (mem8[CUTSCENE_SPRITE_BYTE] - 1);
  }

  if (!tickSubstateTimer(m)) return;

  mem8[INTRO_STEP] = 0;
  mem8[SUBSTATE_TIMER] = (mem8[SUBSTATE_TIMER] + 1);
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);
}
