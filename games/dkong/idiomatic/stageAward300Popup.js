// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward300Popup — stage the lowest award popup's sprite code and deferred-task message,
 * then run the shared popup handler.
 *
 * One of three sibling setters an award draw picks between on two bits of the game's rolling
 * RANDOM byte; this is the arm both bits clear select. Each setter stages its own pair of
 * constants and then runs the same shared handler, which posts the deferred task and stamps the
 * effect sprite's record. For this arm:
 *
 *   - sprite code 0x7D  — stamped into the effect record's code byte by the handler's tail.
 *   - task message opcode 0, argument 3 — posted onto the deferred-task ring.
 *
 * Those two constants are this routine's whole contribution; every observable effect happens
 * inside the shared handler, and nothing else it leaves behind is read.
 *
 * NOT CLAIMED: what the sprite code draws, and what the posted task goes on to do with its
 * argument. Neither is established here.
 *
 * LIVE-OUT: memory-only — everything the shared handler writes.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

const SPRITE_CODE = 0x7d; // stamped into the effect record's code byte
const TASK_MESSAGE = 0x0003; // the deferred-task message: opcode 0, argument 3

export function stageAward300Popup(m) {
  const { regs } = m;

  // Stage this arm's two constants where the shared handler reads them, then run it.
  regs.b = SPRITE_CODE;
  regs.de = TASK_MESSAGE;
  stageAwardPopupAtHitObject(m);
}
