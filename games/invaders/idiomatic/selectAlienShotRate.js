// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_SHOT_RATE_TABLE, ALIEN_SHOT_RATE_THRESHOLDS, loc_20cf } from "./names.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";

// Pick the alien-shot rate for the current field size: the first threshold the count reaches, else the default.
export function selectAlienShotRate(m) {
  const key = m.mem8[currentPlayerRecordPtr(m) + 1];
  let i = 0;
  while (i < 4 && m.mem8[ALIEN_SHOT_RATE_THRESHOLDS + i] < key) i++;
  m.mem8[loc_20cf] = m.mem8[ALIEN_SHOT_RATE_TABLE + i];
}
