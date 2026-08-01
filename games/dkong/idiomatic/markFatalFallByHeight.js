// SPDX-License-Identifier: GPL-3.0-only
/**
 * markFatalFallByHeight — condemn the current fall as lethal once Mario has dropped
 * far enough below where he took off, then refresh his sprite record.  ROM 0x1C76.
 *
 * Reached each airborne frame the fall-height check is armed (MARIO_AIR_LANDCHECK). It
 * measures how far Mario has fallen by comparing his take-off height (MARIO_AIR_START_Y)
 * against his current height with a 15-pixel survivable slack removed. Height grows
 * downward, so once (currentY - 15) has reached the take-off height he is 15 or more
 * pixels below it and the fall is deadly. On that beat it latches MARIO_FATAL_FALL —
 * which the landing code turns into Mario's death, clearing MARIO_ACTIVE — and queues
 * the fall's sound cue. A shallower drop leaves both untouched, so the landing survives.
 *
 * Either way it finishes through the movement machine's shared tail, refreshing Mario's
 * hardware sprite record from his live position and sprite state.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c76.test.js.
 * GATE:     exhaustive — the fatal-vs-survivable decision is a function of just two bytes
 *           (current height, take-off height), so the gate sweeps ALL 65536 pairs; plus
 *           real captured attract dispatches, whose 25m demo fires both arms. Teeth: an
 *           inverted decision, a dropped byte-width wrap, and a dropped sprite refresh.
 * LIVE-OUT: memory-only — MARIO_FATAL_FALL and the fall sound latch (both conditional),
 *           and Mario's 4-byte sprite record. The shared tail's single return is modelled
 *           by one caller-return in the gate; no successor reads a register or flag left
 *           behind here.
 * NAMES:    MARIO_Y (0x6205), MARIO_AIR_START_Y (0x620E), MARIO_FATAL_FALL (0x6220),
 *           SND_TRIGGER (0x6080; +4 is the sound latch this fires) — all from ram.js.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_AIR_START_Y, MARIO_FATAL_FALL, SND_TRIGGER } from "./ram.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js"; // ROM 0x1DA6

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
