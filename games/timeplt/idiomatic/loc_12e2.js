// SPDX-License-Identifier: GPL-3.0-only
/** loc_12e2 — run the sequence delay down by one and, on the frame it reaches zero and only then,
 * let the sequence take its next decision. The countdown wraps rather than sticking, so a delay
 * that starts at zero buys a full 256 frames before the decision comes round again. On every
 * other frame that one decremented cell is the whole effect. LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { passTurnToOtherPlayerIfLivesElseStepSequence } from "./passTurnToOtherPlayerIfLivesElseStepSequence.js";
import { SEQUENCE_DELAY } from "./names.js";

export function loc_12e2(m) {
  const { mem8 } = m;
  const remaining = u8(mem8[SEQUENCE_DELAY] - 1);
  mem8[SEQUENCE_DELAY] = remaining;
  if (remaining !== 0) return;
  passTurnToOtherPlayerIfLivesElseStepSequence(m);
}
