// SPDX-License-Identifier: GPL-3.0-only
/**
 * armAlternateFireModeAtHighDifficulty — stamp mode 2 into field +0x19 of fire records 1 and 3
 * of OBJ_ARRAY_64, but only when both gates open on the same pass:
 *   1. a SIGNED (difficulty - 3) stays non-negative (in play: difficulty 3, 4 or 5);
 *   2. the timing-entropy draw comes up exactly 1.
 * Either gate closed and nothing is written this frame.
 *
 * LIVE-OUT: memory-only — those two field writes.
 */

import { u8 } from "../../../core/int.js";
import { DIFFICULTY, OBJ_ARRAY_64 } from "./names.js";
import { loc_31f6 } from "./loc_31f6.js";

export function armAlternateFireModeAtHighDifficulty(m) {
  const { mem8 } = m;

  const difficulty = mem8[DIFFICULTY];
  if ((u8(difficulty - 3) & 0x80) !== 0) return;

  if (loc_31f6(m) !== 1) return;

  mem8[OBJ_ARRAY_64 + 0x39] = 2;
  mem8[OBJ_ARRAY_64 + 0x79] = 2;
}
