// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward800Popup — effect-sprite setter, third of the 300/500/800 family: load this award's
 * fixed (sprite code, deferred-task message) pair, then tail-jump into the shared award-popup
 * feeder. Reads nothing — both parameters are overwritten with constants. LIVE-OUT: memory-only,
 * every write belonging to the feeder chain, whose return goes to this routine's caller.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

export function stageAward800Popup(m) {
  const { regs } = m;

  // Fixed parameters: the effect sprite's code byte, then the deferred-task message.
  regs.b = 0x7f;
  regs.de = 0x0008;

  stageAwardPopupAtHitObject(m);
}
