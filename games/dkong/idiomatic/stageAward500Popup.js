// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward500Popup — stage the middle award popup's sprite code and deferred-task message,
 * then run the shared popup handler. One of three sibling setters converging on the same handler,
 * each staging its own two constants first. Every memory write happens downstream (the sprite
 * code into the effect record, the message onto the deferred-task ring).
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

export function stageAward500Popup(m) {
  // de re-seats the feeder's message (enqueueTask reads d/e); assign it first in the return
  // tuple so it lands before the call. Sprite code forwarded as the feeder's b param.
  return [(m.regs.de = 5), stageAwardPopupAtHitObject(m, 0x7e)];
}
