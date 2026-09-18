// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward500Popup — stage the middle award popup's sprite code and deferred-task message,
 * then run the shared popup handler.
 *
 * One of three sibling setters that converge on the same shared handler, each staging its own
 * two constants first. This is the middle of the three. The sprite code is stamped into the
 * effect record by the handler's tail; the message is posted onto the deferred-task ring.
 * Every memory write happens downstream. A score popup is the plausible reading, not
 * established here.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

export function stageAward500Popup(m) {
  const { regs } = m;

  regs.b = 0x7e; // sprite code (stamped into the effect record); message opcode 0, argument 5
  regs.de = 0x0005;

  stageAwardPopupAtHitObject(m);
}
