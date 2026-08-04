// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward800Popup — effect-sprite setter: load this award's fixed (sprite code, task
 * message) pair, then hand off to the shared award-popup feeder.
 *
 * The third of three constant setters in the same family — the 300, 500 and 800 award popups
 * — each of which loads its own fixed parameter pair and tail-jumps into the same feeder. The
 * pair is the effect sprite's code byte and the deferred-task message (opcode 0, argument 8);
 * both are pure parameters this routine sets. The feeder then posts the task, reads the
 * sprite's X/Y out of the effect parameter block, and stamps the 4-byte hardware sprite
 * record.
 *
 * This routine READS nothing — it overwrites both parameters with constants regardless of
 * their entry values — so its whole contribution is those two loads plus the hand-off. The
 * hand-off is a TAIL position: the feeder's return goes to this routine's caller.
 *
 * WHAT THIS FILE ESTABLISHES is the mechanics — set two constants, delegate. What the popup
 * finally draws on screen is decided by the feeder chain, not here.
 *
 * LIVE-OUT: memory-only — every write belongs to the feeder chain.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js";

export function stageAward800Popup(m) {
  const { regs } = m;

  // The setter's fixed parameters: the effect sprite's code byte, then the deferred-task
  // message (opcode 0x00, argument 0x08).
  regs.b = 0x7f;
  regs.de = 0x0008;

  // Tail position: hand on to the shared feeder, which consumes the two values just set.
  stageAwardPopupAtHitObject(m);
}
