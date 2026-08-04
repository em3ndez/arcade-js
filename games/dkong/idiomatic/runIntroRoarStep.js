// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroRoarStep — the last step of the opening Kong-climb cutscene: Kong roars, and when the
 * step's time is up the cutscene ends and the how-high screen follows.
 *
 * The cutscene runs as a numbered sequence of steps and this is the final one, called once a
 * frame while it is current. Everything it does keys off SUBSTATE_TIMER, the phase countdown,
 * read as the frame begins:
 *
 *   - at 144 frames remaining, the ROAR fires: the sound priority is set to the roar tune and
 *     held for 3 frames, and one of the cutscene's sprite-object bytes is bumped up by one.
 *   - at 24 frames remaining, that same sprite byte is bumped back down.
 *   - at any other count, neither cue is touched.
 *
 * Then, every frame, the phase countdown is ticked. While it has not expired the routine is done
 * for that frame. On the frame it expires the cutscene ENDS: the step sequence is wrapped back to
 * its first step, and the game's sub-state is moved on to the how-high screen.
 *
 * LIVE-OUT: memory-only — the sound-priority pair, the cutscene sprite byte, the phase countdown,
 * the step sequence and the game sub-state.
 */

import {
  SUBSTATE_TIMER,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  INTRO_STEP,
  GAME_SUBSTATE,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

// One of the cutscene's sprite-object bytes: nudged up when the roar fires and back down
// later in the step. It has no shared name, so it is kept here as its own address.
const CUTSCENE_SPRITE_BYTE = 0x6919;

const ROAR_MARK = 0x90; // countdown value at which the roar fires
const LOWER_MARK = 0x18; // countdown value at which the sprite bump reverses
const ROAR_TUNE = 0x0f; // the sound-priority tune the roar plays
const PRIORITY_PULSE = 0x03; // frames that tune is held for

/** @param {object} m  the machine (memory only). @returns {void} */
export function runIntroRoarStep(m) {
  const { mem } = m;
  const countdown = mem.read8(SUBSTATE_TIMER);

  if (countdown === ROAR_MARK) {
    mem.write8(SND_PRIORITY, ROAR_TUNE);
    mem.write8(SND_PRIORITY_FRAMES, PRIORITY_PULSE);
    mem.write8(CUTSCENE_SPRITE_BYTE, (mem.read8(CUTSCENE_SPRITE_BYTE) + 1) & 0xff);
  } else if (countdown === LOWER_MARK) {
    mem.write8(CUTSCENE_SPRITE_BYTE, (mem.read8(CUTSCENE_SPRITE_BYTE) - 1) & 0xff);
  }

  // Tick the phase countdown; while it has not expired, do nothing more this frame.
  if (!tickSubstateTimer(m)) return;

  // Expired: end the cutscene — wrap the step sequence and move the sub-state on.
  mem.write8(INTRO_STEP, 0);
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
}
