// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAwardPopupAtHitObject — post the caller's deferred message, take the score popup's X and Y
 * out of a parameter block (consuming the X in place), and hand both to the sprite stamp.
 *
 * LIVE-OUT: memory-only — the task ring, the cleared first byte of the parameter block, and
 * whatever the sprite stamp writes.
 */
import { enqueueTask } from "./enqueueTask.js";
import { stampScorePopupSprite } from "./stampScorePopupSprite.js";
import { EFFECT_PARAM_PTR } from "./names.js";

export function stageAwardPopupAtHitObject(m, b = m.regs.b) {
  const { mem8, mem16 } = m;

  enqueueTask(m);

  const block = mem16[EFFECT_PARAM_PTR];

  const a = mem8[block];
  mem8[block] = 0x00;

  stampScorePopupSprite(m, a, b, mem8[(block & 0xff00) | ((block + 3) & 0xff)]);
}
