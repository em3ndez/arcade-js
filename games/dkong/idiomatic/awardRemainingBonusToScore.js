// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardRemainingBonusToScore — pay one score award per digit of the packed bonus readout:
 * the low nibble indexes a "small" award, the high nibble a "large" one (index offset by ten).
 *
 * LIVE-OUT: memory-only — whatever the add-to-score task writes for each of the two awards.
 */

import { BONUS_DISPLAY } from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js";

export function awardRemainingBonusToScore(m) {
  const { mem8 } = m;

  const packed = mem8[BONUS_DISPLAY];

  addToScoreTask(m, packed & 0x0f);

  addToScoreTask(m, ((packed >> 4) + 0x0a) & 0xff);
}
