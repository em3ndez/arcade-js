// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward300Popup — stage the lowest award popup's sprite code and deferred-task message, then
 * run the shared popup handler. One of three sibling setters an award draw picks between on two
 * bits of the rolling RANDOM byte; this is the both-bits-clear arm. It stages the sprite code and
 * task message (opcode 0, argument 3); every observable effect happens inside the shared handler.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

const SPRITE_CODE = 0x7d; // stamped into the effect record's code byte
const TASK_MESSAGE = 0x0003; // the deferred-task message: opcode 0, argument 3

export function stageAward300Popup(m) {
  // Message re-seat: the feeder's enqueueTask reads d/e from the register bridge.
  m.regs.de = TASK_MESSAGE;
  stageAwardPopupAtHitObject(m, SPRITE_CODE); // sprite code forwarded as the feeder's b param
}
