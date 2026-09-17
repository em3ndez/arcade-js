// SPDX-License-Identifier: GPL-3.0-only
/**
 * markFatalFallByHeight — latch MARIO_FATAL_FALL (and cue the fall sound) once Mario's current
 * height, less 15 pixels of survivable slack, has reached his take-off height — i.e. he has
 * dropped 15+ pixels (height grows downward). Then refresh his sprite record through the
 * movement machine's shared tail.
 *
 * LIVE-OUT: memory-only — the fatal-fall latch and the fall sound, both only on the lethal
 * frame, plus Mario's sprite record every frame.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_AIR_START_Y, MARIO_FATAL_FALL, SND_TRIGGER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function markFatalFallByHeight(m) {
  const { mem8 } = m;

  // Byte width: the subtraction can wrap when Mario is still high on screen, and the
  // comparison reads the wrapped value directly.
  const currentLessSlack = u8(mem8[MARIO_Y] - 15);

  if (currentLessSlack >= mem8[MARIO_AIR_START_Y]) {
    mem8[MARIO_FATAL_FALL] = 1;
    mem8[SND_TRIGGER + 4] = 3;
  }

  writeMarioSpriteRecord(m);
}
