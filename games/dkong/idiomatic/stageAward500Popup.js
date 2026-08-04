// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward500Popup — stage the middle award popup's sprite code and deferred-task message,
 * then run the shared popup handler.
 *
 * One of three sibling setters that all converge on the same shared handler, each staging its
 * own two constants first. This is the middle of the three: the other two stage a lower and a
 * higher award, each with its own sprite code and its own task argument. Here the sprite code
 * is 0x7E and the task message is opcode 0, argument 5.
 *
 * The sprite code is stamped into the effect record by the shared handler's tail; the message
 * is posted onto the deferred-task ring. Every memory write happens downstream — the task post,
 * the parameter-block read and its first-byte clear, the record stamp and its board-gated
 * sound. Staging the two constants is all this routine does.
 *
 * NOT CLAIMED: what the effect looks like, or what the posted task does. A score popup is the
 * plausible reading and is not established here.
 *
 * LIVE-OUT: memory-only — everything the shared handler writes.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

export function stageAward500Popup(m) {
  const { regs } = m;

  // Stage this arm's constants: the sprite code the handler's tail stamps into the effect
  // record, and the deferred-task message (opcode 0, argument 5) it posts.
  regs.b = 0x7e;
  regs.de = 0x0005;

  // Run the shared handler; its return is this routine's return.
  stageAwardPopupAtHitObject(m);
}
