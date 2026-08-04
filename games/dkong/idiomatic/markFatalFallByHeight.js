// SPDX-License-Identifier: GPL-3.0-only
/**
 * markFatalFallByHeight — condemn the fall in progress as lethal once Mario has dropped far
 * enough below the height he left the ground at, then refresh his sprite record.
 *
 * It runs on each airborne frame while the fall-height check is armed. How far Mario has fallen
 * is measured by comparing where he took off against where he is now, with 15 pixels of
 * survivable slack taken off the current reading. Height grows downward on this screen, so once
 * his current height less that slack has reached the take-off height he is 15 or more pixels
 * below where he started and the drop is deadly.
 *
 * On the frame that happens, MARIO_FATAL_FALL is latched — the landing turns that into Mario's
 * death — and the fall's sound is cued. A shallower drop leaves both alone, and Mario survives
 * the landing.
 *
 * Either way the routine finishes through the movement machine's shared tail, which refreshes
 * Mario's hardware sprite record from his live position and pose.
 *
 * LIVE-OUT: memory-only — the fatal-fall latch and the fall sound, both only on the lethal
 * frame, plus Mario's sprite record every frame.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_AIR_START_Y, MARIO_FATAL_FALL, SND_TRIGGER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function markFatalFallByHeight(m) {
  const { mem } = m;

  // Mario's current height with the 15-pixel survivable slack pulled off. Kept at byte
  // width because the subtraction can wrap when Mario is still high on the screen, and
  // the comparison below reads the wrapped value directly.
  const currentLessSlack = u8(mem.read8(MARIO_Y) - 15);

  // At or past the take-off height means he has fallen 15 or more pixels: the fall is
  // lethal, so mark it (the landing reads this as a death) and fire the fall sound.
  if (currentLessSlack >= mem.read8(MARIO_AIR_START_Y)) {
    mem.write8(MARIO_FATAL_FALL, 1);
    mem.write8(SND_TRIGGER + 4, 3); // 3-frame assert on the fall sound latch
  }

  // Shared movement-machine tail: copy Mario's live fields into his sprite record.
  writeMarioSpriteRecord(m);
}
