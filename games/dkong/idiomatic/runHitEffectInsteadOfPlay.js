// SPDX-License-Identifier: GPL-3.0-only
/**
 * runHitEffectInsteadOfPlay — the per-frame gate on the hit-effect latch. Latch clear: return true
 * and the caller runs its ordinary frame. Latch set (any nonzero): spend the frame on one beat of
 * the effect sequence instead, then return false so the caller abandons the rest of its cascade.
 *
 * LIVE-OUT: the caller-skip boolean, plus whatever memory the effect beat writes.
 */

import { dispatchEffectSequenceStep } from "./dispatchEffectSequenceStep.js";
import { loc_1e94 } from "./loc_1e94.js";
import { HIT_EFFECT_LATCH } from "./names.js";

export function runHitEffectInsteadOfPlay(m) {
  const { mem8 } = m;

  if (mem8[HIT_EFFECT_LATCH] === 0) return true;

  dispatchEffectSequenceStep(m);
  return loc_1e94(m);
}
